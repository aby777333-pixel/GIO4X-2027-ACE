import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { ImageResponse } from "next/og";
import { site } from "@/config/site";

/**
 * GIO4X share cards (Open Graph / X).
 * One composition for the whole site so every shared link carries the same
 * identity: ivory ground, the logo, an eyebrow, a TT Norms statement and the
 * DNA rule. Cards never contain market data (it would be stale by the time a
 * link is opened).
 */
export const OG_SIZE = { width: 1200, height: 630 };
export const OG_CONTENT_TYPE = "image/png";

/**
 * Project root. Normally the process cwd; when the dev server is started from
 * another directory, walk up from the compiled module until the font folder
 * is found.
 */
function findRoot(): string {
  const marker = path.join("src", "fonts", "og", "TTNorms-Light.otf");
  if (existsSync(path.join(process.cwd(), marker))) return process.cwd();
  let dir = __dirname;
  for (let i = 0; i < 12; i++) {
    if (existsSync(path.join(dir, marker))) return dir;
    const up = path.dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return process.cwd();
}
const root = findRoot();
let assets: Promise<{ light: Buffer; medium: Buffer; logo: string }> | null = null;

function loadAssets() {
  if (!assets) {
    assets = Promise.all([
      readFile(path.join(root, "src/fonts/og/TTNorms-Light.otf")),
      readFile(path.join(root, "src/fonts/og/TTNorms-Medium.otf")),
      readFile(path.join(root, "public/brand/gio4x-logo.png")),
    ]).then(([light, medium, logo]) => ({ light, medium, logo: `data:image/png;base64,${logo.toString("base64")}` }));
  }
  return assets;
}

export async function renderOg({ eyebrow, title, detail }: { eyebrow: string; title: string; detail?: string }) {
  const { light, medium, logo } = await loadAssets();
  const size = title.length > 60 ? 62 : title.length > 36 ? 76 : 92;
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#f6f4ee",
          color: "#14191d",
          padding: "68px 76px",
          fontFamily: "TT Norms",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={logo} alt="" width={241} height={75} />
          <div style={{ display: "flex", fontSize: 20, letterSpacing: 4, textTransform: "uppercase", color: "#626b73", fontWeight: 500 }}>{eyebrow}</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", maxWidth: 930 }}>
          <div style={{ display: "flex", fontSize: size, lineHeight: 1.06, letterSpacing: -2, fontWeight: 300 }}>{title}</div>
          {detail ? <div style={{ display: "flex", marginTop: 26, fontSize: 28, lineHeight: 1.4, color: "#3f474e", fontWeight: 300 }}>{detail}</div> : null}
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ display: "flex", height: 2, width: "100%", background: "linear-gradient(90deg, #00a098 0%, #0870b8 38.2%, #089040 61.8%, rgba(8,144,64,0) 100%)" }} />
          <div style={{ display: "flex", justifyContent: "space-between", marginTop: 22, fontSize: 22, color: "#626b73", fontWeight: 500 }}>
            <div style={{ display: "flex", letterSpacing: 3, textTransform: "uppercase" }}>{site.tagline}</div>
            <div style={{ display: "flex" }}>{site.domain}</div>
          </div>
        </div>
      </div>
    ),
    {
      ...OG_SIZE,
      fonts: [
        { name: "TT Norms", data: light, weight: 300, style: "normal" },
        { name: "TT Norms", data: medium, weight: 500, style: "normal" },
      ],
    },
  );
}
