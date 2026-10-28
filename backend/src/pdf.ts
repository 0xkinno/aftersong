// A one-page "about me" sheet as a plain PDF, written by hand so there is nothing to install.
// Built only from confirmed favourites and logged reactions.
import { claimViolations, houseStyleViolations } from "./core/house-style.ts";

export interface LifeStory {
  firstName: string;
  birthYear: number;
  hometown: string;
  window: { start: number; end: number };
  favourites: string[];
  works: Array<{ name: string; domain: string; value: string }>;
  avoid: string[];
  updated: string;
}

const latin = (s: string) => s.replace(/[^\x20-\x7E -ÿ]/g, "?").replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

function wrap(text: string, width: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const w of text.split(/\s+/)) {
    if ((line + " " + w).trim().length > width) {
      out.push(line);
      line = w;
    } else line = (line + " " + w).trim();
  }
  if (line) out.push(line);
  return out;
}

export function lifeStoryLines(s: LifeStory): Array<{ text: string; size: number; gap: number }> {
  const L: Array<{ text: string; size: number; gap: number }> = [];
  const h = (t: string) => L.push({ text: t, size: 13, gap: 10 });
  const p = (t: string) => wrap(t, 88).forEach((x) => L.push({ text: x, size: 10.5, gap: 2 }));
  L.push({ text: `About ${s.firstName}`, size: 20, gap: 4 });
  p(`Born ${s.birthYear}. Grew up in ${s.hometown}. Best remembered years: ${s.window.start} to ${s.window.end}.`);
  h("Favourites the family confirmed");
  p(s.favourites.length ? s.favourites.join(", ") : "None confirmed yet.");
  h("What has worked, as logged by the carer");
  if (s.works.length === 0) p("Nothing logged yet.");
  for (const w of s.works.slice(0, 12)) p(`${w.name} (${w.domain}): ${w.value.replace(/_/g, " ")}`);
  h("What to avoid");
  p(s.avoid.length ? s.avoid.join(", ") : "Nothing logged.");
  L.push({ text: "", size: 8, gap: 10 });
  p(`Updated ${s.updated}. Suggestions come from Qloo taste data and are not medical advice. Only the carer's logged reactions count as what worked.`);
  return L;
}

export function lifeStoryPdf(s: LifeStory): Buffer {
  const lines = lifeStoryLines(s);
  for (const l of lines) {
    const bad = [...houseStyleViolations(l.text), ...claimViolations(l.text)];
    if (bad.length) throw new Error(`life story text breaks house style: ${bad.join(",")}`);
  }
  let y = 790;
  const ops: string[] = ["BT"];
  for (const l of lines) {
    y -= l.size + l.gap;
    ops.push(`/F1 ${l.size} Tf 1 0 0 1 56 ${y} Tm (${latin(l.text)}) Tj`);
  }
  ops.push("ET");
  const stream = ops.join("\n");
  const objs = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>",
    `<< /Length ${Buffer.byteLength(stream, "latin1")} >>\nstream\n${stream}\nendstream`,
  ];
  let out = "%PDF-1.4\n";
  const offsets: number[] = [];
  objs.forEach((o, i) => {
    offsets.push(Buffer.byteLength(out, "latin1"));
    out += `${i + 1} 0 obj\n${o}\nendobj\n`;
  });
  const xref = Buffer.byteLength(out, "latin1");
  out += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("")}trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
  return Buffer.from(out, "latin1");
}
