import { spawn } from "node:child_process";
import fs from "node:fs";

const CHROME_PATH = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
const PORT = 9222;

const VIEWPORTS = [
  { width: 320, height: 640, label: "320px (Compact Mobile / iPhone SE 1st gen)" },
  { width: 360, height: 740, label: "360px (Android Common / Galaxy S8)" },
  { width: 375, height: 667, label: "375px (iPhone SE 2/3, iPhone 8)" },
  { width: 390, height: 844, label: "390px (iPhone 12/13/14)" },
  { width: 430, height: 932, label: "430px (iPhone 14/15/16 Pro Max)" },
];

const ROUTES = [
  { path: "/orders", name: "Orders List & Matched Bids" },
  { path: "/orders/ORD-20261021-9964", name: "Order Contract Details & Logistics/Bank Cards" },
  { path: "/payments", name: "Farmer Payments & Payout History" },
];

const LANGUAGES = ["en", "hi", "mr"];

interface CdpMessage {
  id: number;
  method?: string;
  params?: any;
  result?: any;
  error?: any;
}

class CdpClient {
  private ws: WebSocket;
  private msgId = 1;
  private callbacks = new Map<number, (res: any) => void>();

  constructor(wsUrl: string) {
    this.ws = new WebSocket(wsUrl);
  }

  async connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      this.ws.onopen = () => resolve();
      this.ws.onerror = (e) => reject(e);
      this.ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data.toString()) as CdpMessage;
          if (data.id && this.callbacks.has(data.id)) {
            const cb = this.callbacks.get(data.id)!;
            this.callbacks.delete(data.id);
            if (data.error) {
              cb({ error: data.error });
            } else {
              cb(data.result);
            }
          }
        } catch {}
      };
    });
  }

  send(method: string, params: any = {}): Promise<any> {
    const id = this.msgId++;
    return new Promise((resolve) => {
      this.callbacks.set(id, resolve);
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  close() {
    this.ws.close();
  }
}

async function startChrome(): Promise<any> {
  const chromeProc = spawn(
    CHROME_PATH,
    [
      `--remote-debugging-port=${PORT}`,
      "--headless=new",
      "--disable-gpu",
      "--no-sandbox",
      "--disable-dev-shm-usage",
      "--user-data-dir=C:\\Users\\Rahil Mulani\\.gemini\\temp-chrome-profile-mobile",
      "about:blank",
    ],
    { stdio: "ignore" }
  );
  await new Promise((r) => setTimeout(r, 2000));
  return chromeProc;
}

async function getWsUrl(): Promise<string> {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const pages = (await res.json()) as any[];
  if (pages.length > 0) return pages[0].webSocketDebuggerUrl;
  const newPageRes = await fetch(`http://127.0.0.1:${PORT}/json/new`);
  const newPage = (await newPageRes.json()) as any;
  return newPage.webSocketDebuggerUrl;
}

async function runMobileAudit() {
  console.log("=== STARTING PAYMENT & TRANSPORT MOBILE AUDIT ===");
  console.log("Testing Viewports: 320px, 360px, 375px, 390px, 430px");
  console.log("Testing Routes: /orders, /orders/ORD-20261021-9964, /payments");
  console.log("Languages: English (en), Hindi (hi), Marathi (mr)\n");

  const chromeProc = await startChrome();
  const wsUrl = await getWsUrl();
  const client = new CdpClient(wsUrl);
  await client.connect();

  await client.send("Page.enable");
  await client.send("DOM.enable");
  await client.send("Runtime.enable");

  let totalScenarios = 0;
  let passedScenarios = 0;

  try {
    for (const lang of LANGUAGES) {
      console.log(`\n=========================================================`);
      console.log(`  LANGUAGE: ${lang.toUpperCase()}`);
      console.log(`=========================================================`);

      // Set language in localStorage
      await client.send("Page.navigate", { url: "http://localhost:8080/" });
      await new Promise((r) => setTimeout(r, 1000));
      await client.send("Runtime.evaluate", {
        expression: `localStorage.setItem('aiaic.lang', '${lang}');`,
      });

      for (const vp of VIEWPORTS) {
        console.log(`\n[Viewport: ${vp.label}]`);
        await client.send("Emulation.setDeviceMetricsOverride", {
          width: vp.width,
          height: vp.height,
          deviceScaleFactor: 2,
          mobile: true,
        });

        for (const route of ROUTES) {
          totalScenarios++;
          await client.send("Page.navigate", { url: `http://localhost:8080${route.path}` });
          await new Promise((r) => setTimeout(r, 800));

          const evalRes = await client.send("Runtime.evaluate", {
            expression: `
              (() => {
                const doc = document.documentElement;
                return {
                  scrollWidth: doc.scrollWidth,
                  clientWidth: doc.clientWidth,
                  hasHorizontalScroll: doc.scrollWidth > doc.clientWidth,
                };
              })()
            `,
            returnByValue: true,
          });

          const val = evalRes?.result?.value || {};
          const scrollWidth = val.scrollWidth || 0;
          const clientWidth = val.clientWidth || vp.width;
          const passed = scrollWidth <= clientWidth;

          if (passed) passedScenarios++;

          console.log(
            `${passed ? "✓ PASS" : "✗ FAIL"} | [${lang}] ${route.path.padEnd(30)} @ ${vp.width}px | Client=${clientWidth}px, Scroll=${scrollWidth}px`
          );
        }
      }
    }
  } finally {
    client.close();
    chromeProc.kill();
  }

  console.log(`\n=========================================================`);
  console.log(`MOBILE AUDIT SUMMARY`);
  console.log(`Total Scenarios Tested: ${totalScenarios}`);
  console.log(`Passed Scenarios:       ${passedScenarios}`);
  console.log(`Failed Scenarios:       ${totalScenarios - passedScenarios}`);
  console.log(`Pass Rate:              ${Math.round((passedScenarios / totalScenarios) * 100)}%`);
  console.log(`=========================================================\n`);

  if (passedScenarios < totalScenarios) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMobileAudit().catch((err) => {
  console.error("Audit failed:", err);
  process.exit(1);
});
