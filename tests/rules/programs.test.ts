// Program identification on real page titles collected 2026-10-24.
import { test } from "node:test";
import assert from "node:assert/strict";
import { degreeKey, identifyProgram } from "../../convex/lib/catalog/programs.ts";
import config from "../../config/institutions.json" with { type: "json" };

const id = (title: string, url = "https://x.ac.uk/p", markers: string[] = []) => identifyProgram({ title, url }, config.majors, markers);
const psu = config.institutions.find((i) => i.slug === "psu")!.otherCampusMarkers!;

test("single-subject bachelor's pages become programs with their degree", () => {
  const cases: [string, string, string][] = [
    ["Computer Science BSc | Undergraduate study | The University of Sheffield", "cs", "BSc"],
    ["Economics, BS (Boston) < Northeastern University Academic Catalog", "econ", "BS"],
    ["Computer Sciences, BS < University of Wisconsin-Madison", "cs", "BS"],
    ["Computer Science (B.S.) | College of Engineering | Michigan State University", "cs", "BS"],
    ["Computer Science, B.S. (Engineering) &vert; Penn State", "cs", "BS"],
    ["Economics BSc Hons (L100) - Lancaster University", "econ", "BSc"],
    ["BAEcon Economics (2027 entry) | The University of Manchester", "econ", "BAEcon"],
    ["Computer Science BSc (Hons)", "cs", "BSc"],
    ["BSc Economics | Triple-Accredited Business School | University of Exeter", "econ", "BSc"],
  ];
  for (const [title, major, degree] of cases) {
    const p = id(title);
    assert.ok(p, title);
    assert.equal(p!.major, major, title);
    assert.equal(p!.degree, degree, title);
    assert.equal(p!.joint, false, title);
  }
});

test("joint programs are programs, marked joint", () => {
  for (const t of ["Economics with Finance BSc | Undergraduate study | The University of Sheffield", "BSc Economics and Politics | University of Exeter",
    "Computer Science and Artificial Intelligence BSc | Undergraduate study | Loughborough University", "Mathematics with Economics BSc | Undergraduate study | Loughborough University"]) {
    assert.equal(id(t)?.joint, true, t);
  }
});

test("listing pages, variants, other campuses and non-programs are not programs", () => {
  for (const t of [
    "Computer Science with a Foundation Year BSc | Undergraduate study | The University of Sheffield",
    "BSc Computer Science (Transfer) - Lancaster University",
    "Engineering Modified with Computer Science | Dartmouth Engineering",
    "Economics courses", "Undergraduate courses | Economics | The University of Sheffield",
    "Home | Department of Economics | Illinois", "2027 Best Undergraduate Economics Programs Rankings | US News Rankings",
    "Undergraduate Programs in Computer Sciences – Computer Sciences – UW–Madison", "Department of Economics",
    "Blended CS Degrees | Siebel School of Computing and Data Science | Illinois",
  ]) assert.equal(id(t), null, t);
  assert.equal(id("Computer Science (B.S.) | Penn State Harrisburg", "https://harrisburg.psu.edu/x", psu), null);
  assert.equal(id("Computer Science Degree | Penn State Hazleton", "https://hazleton.psu.edu/x", psu), null);
});

test("a major page without a degree token is kept but flagged; entry year comes from the URL", () => {
  const p = id("CS Major | Department of Computer Science", "https://web.cs.dartmouth.edu/undergraduate/undergraduate-programs/cs-major");
  assert.ok(p && p.degree === null && p.reasons.length === 1 && p.joint === false);
  assert.equal(id("Economics BSc Hons (L100) - Lancaster University", "https://www.lancaster.ac.uk/study/undergraduate/courses/economics-bsc-hons-l100/2027/")?.entryYear, 2027);
});

test("degree families merge pages about the same program but keep different degrees apart", () => {
  assert.equal(degreeKey("BS"), degreeKey("BSCS"));
  assert.equal(degreeKey("B.S."), "BS");
  assert.notEqual(degreeKey("BSc"), degreeKey("BAEcon"));
  assert.equal(degreeKey("AB"), "BA");
});
