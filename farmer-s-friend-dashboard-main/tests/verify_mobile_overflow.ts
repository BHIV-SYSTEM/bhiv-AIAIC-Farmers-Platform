import { spawn, ChildProcess } from "node:child_process";

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
  { path: "/", name: "Dashboard / Home" },
  { path: "/ask", name: "Ask / District & Crop Selection" },
  { path: "/result?region=Pune&crop=Tomato", name: "Result / Plant & Market Intelligence" },
  {
    path: "/advice/market?region=Pune&crop=Tomato",
    name: "Advice / Price Series & Recommendations",
  },
  { path: "/listing/new", name: "New Produce Listing Form" },
  { path: "/listings", name: "Produce Listing Directory & Filters" },
  { path: "/orders", name: "Orders & Matched Buyer Offers" },
  { path: "/orders/ORD-20261021-9964", name: "Order Contract Details & Financial Table" },
  { path: "/review?region=Pune&crop=Tomato", name: "Agronomist Raw Review Packet" },
];

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
        } catch (_e) {
          /* ignore */
        }
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

  close(): void {
    try {
      this.ws.close();
    } catch (_e) {
      /* ignore */
    }
  }
}

async function startChrome(): Promise<ChildProcess> {
  const chrome = spawn(
    CHROME_PATH,
    [
      "--headless=new",
      `--remote-debugging-port=${PORT}`,
      "--disable-gpu",
      "--no-sandbox",
      "--disable-extensions",
      "--disable-background-networking",
      "about:blank",
    ],
    { stdio: "ignore" },
  );

  // Poll for debugger URL
  let attempts = 0;
  while (attempts < 30) {
    await new Promise((r) => setTimeout(r, 200));
    try {
      const res = await fetch(`http://127.0.0.1:${PORT}/json/version`);
      if (res.ok) return chrome;
    } catch (_e) {
      /* retry polling */
    }
    attempts++;
  }
  throw new Error("Failed to start headless Chrome with remote debugging.");
}

async function getWsUrl(): Promise<string> {
  const res = await fetch(`http://127.0.0.1:${PORT}/json/list`);
  const pages = (await res.json()) as any[];
  if (pages.length > 0 && pages[0].webSocketDebuggerUrl) {
    return pages[0].webSocketDebuggerUrl;
  }
  const newPageRes = await fetch(`http://127.0.0.1:${PORT}/json/new`);
  const newPage = (await newPageRes.json()) as any;
  return newPage.webSocketDebuggerUrl;
}

interface TestResult {
  route: string;
  viewport: string;
  scrollWidth: number;
  clientWidth: number;
  overflowPx: number;
  overflowingElementsCount: number;
  passed: boolean;
  notes?: string;
}

async function runAudit() {
  console.log("=== STARTING AUTOMATED MOBILE OVERFLOW AUDIT SUITE ===");
  console.log("Targeting viewports: 320px, 360px, 375px, 390px, 430px");
  console.log(
    "Verifying document.documentElement.scrollWidth <= document.documentElement.clientWidth\n",
  );

  const chromeProc = await startChrome();
  const wsUrl = await getWsUrl();
  const client = new CdpClient(wsUrl);
  await client.connect();

  await client.send("Page.enable");
  await client.send("DOM.enable");
  await client.send("Runtime.enable");

  const results: TestResult[] = [];
  let totalTests = 0;
  let passedTests = 0;

  try {
    for (const vp of VIEWPORTS) {
      console.log(`\n---------------------------------------------------------`);
      console.log(`TESTING VIEWPORT: ${vp.label} (${vp.width}x${vp.height})`);
      console.log(`---------------------------------------------------------`);

      await client.send("Emulation.setDeviceMetricsOverride", {
        width: vp.width,
        height: vp.height,
        deviceScaleFactor: 2,
        mobile: true,
      });

      for (const route of ROUTES) {
        totalTests++;
        const targetUrl = `http://localhost:8080${route.path}`;

        await client.send("Page.navigate", { url: targetUrl });
        // Wait for page load and any dynamic rendering/charts
        await new Promise((r) => setTimeout(r, 1200));

        // Evaluate overflow metrics and find offending elements
        const evalRes = await client.send("Runtime.evaluate", {
          expression: `
            (() => {
              const docEl = document.documentElement;
              const scrollW = docEl.scrollWidth;
              const clientW = docEl.clientWidth;
              const bodyW = document.body ? document.body.scrollWidth : 0;
              const winInnerW = window.innerWidth;

              const overflowing = [];
              const all = document.querySelectorAll('*');
              for (const el of all) {
                const rect = el.getBoundingClientRect();
                // Check if element extends past viewport bounds (ignoring 1px rounding)
                if (rect.right > winInnerW + 1.5 && rect.width > 0 && rect.height > 0) {
                  // Check if this element is inside an intentional scroll container that itself fits inside the viewport
                  let parent = el.parentElement;
                  let isClipped = false;
                  while (parent && parent !== document.body && parent !== docEl) {
                    const pStyle = window.getComputedStyle(parent);
                    if (pStyle.overflowX === 'auto' || pStyle.overflowX === 'scroll' || pStyle.overflowX === 'hidden' || pStyle.overflow === 'hidden') {
                      const pRect = parent.getBoundingClientRect();
                      if (pRect.right <= winInnerW + 1.5) {
                        isClipped = true;
                        break;
                      }
                    }
                    parent = parent.parentElement;
                  }

                  if (!isClipped) {
                    const tag = el.tagName.toLowerCase();
                    const cls = (el.className && typeof el.className === 'string') ? el.className.split(' ').slice(0, 3).join('.') : '';
                    const id = el.id ? '#' + el.id : '';
                    overflowing.push(tag + id + (cls ? '.' + cls : '') + ' (right=' + Math.round(rect.right) + 'px)');
                  }
                }
              }

              return {
                scrollWidth: scrollW,
                clientWidth: clientW,
                winInnerW: winInnerW,
                bodyScrollWidth: bodyW,
                overflowingCount: overflowing.length,
                overflowingSample: overflowing.slice(0, 3)
              };
            })()
          `,
          returnByValue: true,
        });

        const val = evalRes?.result?.value || {};
        const scrollWidth = val.scrollWidth || 0;
        const clientWidth = val.clientWidth || vp.width;
        const overflowPx = Math.max(0, scrollWidth - clientWidth);
        const passed = overflowPx <= 1 && val.overflowingCount === 0;

        if (passed) passedTests++;

        const resItem: TestResult = {
          route: route.path,
          viewport: `${vp.width}px`,
          scrollWidth,
          clientWidth,
          overflowPx,
          overflowingElementsCount: val.overflowingCount || 0,
          passed,
          notes: val.overflowingSample?.join(", ") || "",
        };
        results.push(resItem);

        const statusMark = passed ? "✓ PASS" : "✗ FAIL";
        console.log(
          `${statusMark} | ${route.path.padEnd(45)} | W=${clientWidth}px, ScrollW=${scrollWidth}px (diff=${overflowPx}px)`,
        );
        if (!passed && val.overflowingSample?.length) {
          console.log(`     -> Overflowing: ${val.overflowingSample.join(", ")}`);
        }
      }
    }

    // Now test language toggle: Switch to Marathi ('mr') at 320px and 375px
    console.log(`\n---------------------------------------------------------`);
    console.log(`TESTING TRANSLATED LOCALE: Marathi ('mr') at 320px & 375px`);
    console.log(`---------------------------------------------------------`);

    for (const w of [320, 375]) {
      await client.send("Emulation.setDeviceMetricsOverride", {
        width: w,
        height: 667,
        deviceScaleFactor: 2,
        mobile: true,
      });

      // Navigate to /ask and set localStorage lang to 'mr'
      await client.send("Page.navigate", { url: "http://localhost:8080/ask" });
      await new Promise((r) => setTimeout(r, 600));

      await client.send("Runtime.evaluate", {
        expression: `localStorage.setItem('aiaic-lang', 'mr'); location.reload();`,
      });
      await new Promise((r) => setTimeout(r, 1200));

      for (const route of [
        { path: "/ask", name: "Ask / State & District" },
        { path: "/listings", name: "Listings Directory" },
        { path: "/orders", name: "Orders List" },
        { path: "/orders/ORD-20261021-9964", name: "Order Contract Details" },
      ]) {
        totalTests++;
        await client.send("Page.navigate", { url: `http://localhost:8080${route.path}` });
        await new Promise((r) => setTimeout(r, 1000));

        const evalRes = await client.send("Runtime.evaluate", {
          expression: `
            (() => {
              const docEl = document.documentElement;
              return {
                scrollWidth: docEl.scrollWidth,
                clientWidth: docEl.clientWidth,
              };
            })()
          `,
          returnByValue: true,
        });

        const val = evalRes?.result?.value || {};
        const scrollWidth = val.scrollWidth || 0;
        const clientWidth = val.clientWidth || w;
        const overflowPx = Math.max(0, scrollWidth - clientWidth);
        const passed = overflowPx <= 1;
        if (passed) passedTests++;

        console.log(
          `${passed ? "✓ PASS" : "✗ FAIL"} | (mr) ${route.path.padEnd(40)} @ ${w}px | W=${clientWidth}px, ScrollW=${scrollWidth}px`,
        );
      }

      // Reset back to English
      await client.send("Runtime.evaluate", {
        expression: `localStorage.setItem('aiaic-lang', 'en');`,
      });
    }
  } finally {
    client.close();
    chromeProc.kill();
  }

  console.log(`\n=========================================================`);
  console.log(`MOBILE OVERFLOW AUDIT SUMMARY`);
  console.log(`Total Scenarios Tested: ${totalTests}`);
  console.log(`Passed Scenarios:       ${passedTests}`);
  console.log(`Failed Scenarios:       ${totalTests - passedTests}`);
  console.log(`Pass Rate:              ${Math.round((passedTests / totalTests) * 100)}%`);
  console.log(`=========================================================\n`);

  if (passedTests < totalTests) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runAudit().catch((err) => {
  console.error("Test execution failed:", err);
  process.exit(1);
});
