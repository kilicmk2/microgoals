import { Goal } from "./store";
import { v4 as uuidv4 } from "uuid";

const now = new Date().toISOString();
let order = 0;

function goal(
  title: string,
  horizon: Goal["horizon"],
  category: Goal["category"],
  opts: Partial<Goal> = {}
): Goal {
  return {
    id: uuidv4(),
    title,
    description: opts.description || "",
    status: opts.status || "not_started",
    horizon,
    category,
    owner: opts.owner || "",
    parentId: opts.parentId || null,
    reasoning: opts.reasoning || "",
    pinned: opts.pinned || false,
    order: order++,
    createdAt: now,
    updatedAt: now,
  };
}

export function getSeedGoals(): Goal[] {
  return [
    // ===== 5 YEAR =====
    goal("Become the leading European robotics data infrastructure company", "5y", "company", {
      pinned: true,
      reasoning: "Terminal value: own the data layer between European industries and robotics labs. B2B relationships in factories, logistics, hospitality become deployment partnerships when robots arrive.",
      owner: "Bercan",
    }),
    goal("Build deployment partnerships in European factories and logistics", "5y", "company", {
      reasoning: "Once robots deploy, the company that owns the environment relationship + data from that environment becomes the deployment partner. Trillion-dollar mode.",
    }),
    goal("Full multi-modal data stack: stereo, tactile, EEG, audio", "5y", "company", {
      reasoning: "Each new modality is a new wave of demand. Stereo next, then tactile, then EEG. Being early on each creates compounding advantage.",
    }),
    goal("Expand to US market for homes and commercial data", "5y", "company", {
      reasoning: "American homes are different from European. Figure AI already signaling European data preference. US data = separate value pool.",
    }),

    // ===== 2 YEAR =====
    goal("Establish dominant European data collection network across 5+ countries", "2y", "company", {
      pinned: true,
      reasoning: "European data is our core differentiator. No competitor has built collection culture in Europe. First mover advantage is real here.",
      owner: "Bercan",
    }),
    goal("Scale to 50K+ hours of high-quality European ego data", "2y", "company", {
      reasoning: "Scale matters — customers need volume. 50K hours makes us a serious catalog player, not a boutique.",
    }),
    goal("Launch stereo glasses product (Shift) at scale", "2y", "company", {
      reasoning: "Stereo/depth is next modality wave. Having our own hardware for stereo collection = vertical integration advantage.",
      owner: "Anton",
    }),
    goal("Secure 3+ recurring lab contracts (GDM, Nvidia, Figure-tier)", "2y", "company", {
      reasoning: "Recurring revenue from top labs validates the business model and provides stable cash flow for growth.",
    }),
    goal("Establish tactile data capability via partner or acquisition", "2y", "company", {
      reasoning: "Tactile is 12-18 months out from serious demand. Need glove R&D partnership now. Open Graph Labs or similar.",
    }),

    // ===== 1 YEAR =====
    goal("Europe becomes primary data collection region (>60% of hours)", "1y", "company", {
      pinned: true,
      reasoning: "Indian mono data saturating within a year. European data will command premium pricing. Figure email confirmed European data preference.",
      owner: "Bercan",
    }),
    goal("Exit India for low-quality collection; keep only high-quality environments with own devices", "1y", "company", {
      reasoning: "Indian homes = no differentiation, 70+ competitors, race to bottom. Only keep hotel/factory environments on own devices with stereo.",
      status: "in_progress",
    }),
    goal("Shift Richard to Europe; hire senior European ops lead", "1y", "company", {
      reasoning: "Richard has ops experience but is stuck in India. Europe needs someone building relationships on the ground. Factory partnerships require senior person with B2B credibility.",
      owner: "Anton",
    }),
    goal("Launch mobile app collection at scale across Europe and Turkey", "1y", "company", {
      reasoning: "Mobile phone collection (especially iPhone stereo from 16+) is scalable and European-friendly. Top-of-funnel for Shift.",
      status: "in_progress",
      owner: "Anton",
    }),
    goal("Build annotation product inside the app as top-of-funnel", "1y", "company", {
      reasoning: "Unique mode: collectors annotate their own data, creating quality signal. No competitor does collect + annotate in one pipeline.",
      owner: "Anton",
    }),
    goal("Close Series A funding round", "1y", "company", {
      reasoning: "Need capital to scale European operations. Strong positioning with European data thesis + hardware + pipeline.",
      owner: "Bercan",
    }),

    // ===== 6 MONTH =====
    goal("Deliver Google DeepMind contract successfully", "6m", "company", {
      pinned: true,
      status: "in_progress",
      reasoning: "Anchor customer. Pipeline output quality and volume are critical. Good delivery = reference for Nvidia and others.",
      owner: "Anton",
    }),
    goal("Win Nvidia data contract (be 1 of 5 selected)", "6m", "company", {
      pinned: true,
      reasoning: "Nvidia contract = massive revenue and validation. First delivery is 10 hours of perfect data with correct distribution.",
      owner: "Bercan",
    }),
    goal("Scale European mobile collection to 1000+ contributors", "6m", "company", {
      reasoning: "Germany, Turkey, Bulgaria initial focus. Need critical mass of collectors for diverse environments.",
      owner: "Richard",
    }),
    goal("Fix pipeline bottlenecks: SLAM, ingress, session orchestrator", "6m", "company", {
      status: "in_progress",
      reasoning: "SLAM failures lose videos. Ingress needs to handle external device data. Session orchestrator needs per-scene hour limits. Primary technical blockers.",
      owner: "Nico",
    }),
    goal("Develop cheap stereo device (<$100) for partner collection", "6m", "company", {
      reasoning: "Partners in India/Turkey can collect stereo if device is cheap. SD card + phone pairing. Much higher value than mono.",
    }),
    goal("Evaluate and decide on Open Graph Labs partnership/investment", "6m", "company", {
      reasoning: "Camera sync infra + tactile glove hedge + Nvidia Korean connections. $250K investment. Need tech due diligence with Zeno first.",
      owner: "Bercan",
    }),
    goal("Launch public brand presence — Shift product announcement", "6m", "company", {
      reasoning: "Create buzz on X/LinkedIn before competitors dominate mindshare. VCs see presence, labs reach out proactively.",
      owner: "Bercan",
    }),
    goal("Close Robco contract and 2 additional non-exclusive deals", "6m", "company", {
      reasoning: "Robco already interested ($100K level). Non-exclusive model works if data quality is top-notch. Sell same data to 6-7 companies.",
      owner: "Bercan",
    }),

    // ===== MONTHLY =====
    goal("Finalize 6-month strategy document with backwards-engineered goals", "monthly", "company", {
      pinned: true,
      status: "in_progress",
      reasoning: "Team lacks clarity on direction. Strategy must be written, visual, usable in every meeting. Everyone needs to see it and work from it.",
      owner: "Bercan",
    }),
    goal("Process and deliver India custom data (800 usable hours from PCB factory)", "monthly", "company", {
      status: "in_progress",
      reasoning: "Already paid for. Filter out build device footage. Only deliver phone-collected data. Handle foreign key / user ID database issues.",
      owner: "Anton",
    }),
    goal("Integrate external device data into pipeline (relax foreign key, handle timestamps)", "monthly", "company", {
      status: "in_progress",
      reasoning: "Nico estimated 1 week. Needed for built device data ingestion. Must handle overlapping timestamps and external user IDs.",
      owner: "Nico",
    }),
    goal("Set fundraising preparation date — target April 20", "monthly", "company", {
      reasoning: "4 weeks to prepare: customer substance, public launch moment, investor materials. Everything we can do in that time, then go.",
      owner: "Bercan",
    }),
    goal("Schedule tech due diligence call with Open Graph Labs (Zeno, Alex, Nico)", "monthly", "company", {
      reasoning: "Before any investment decision. Need live demo of camera sync, understand APIs, evaluate tactile glove roadmap.",
      owner: "Yoan",
    }),

    // ===== WEEKLY =====
    goal("Write down 6-month strategy with reasoning — first draft by Wednesday", "weekly", "company", {
      pinned: true,
      status: "in_progress",
      reasoning: "Committed to Artjem. Will do pen-and-paper first, then digital. Must include why behind each goal so team understands when reasons change.",
      owner: "Bercan",
    }),
    goal("Get India custom data through pipeline — test with varied user IDs", "weekly", "company", {
      status: "in_progress",
      reasoning: "Daniel and Nico working on it. Need to vary user IDs, handle 3-4 hour recordings, filter build device footage.",
      owner: "Daniel",
    }),
    goal("Talk to Richard about timeline for Europe transition", "weekly", "company", {
      reasoning: "Don't force immediate move. Ask what's reasonable. He sent India hiring list yesterday — needs to understand strategic shift.",
      owner: "Anton",
    }),
    goal("Fix Android upside-down video bug in mobile app", "weekly", "company", {
      reasoning: "Seen in QA check. Bad look for data quality. Quick fix needed.",
      owner: "Anton",
    }),
    goal("Prioritize SLAM over sync — assign Orest or Jot accordingly", "weekly", "company", {
      reasoning: "SLAM is primary bottleneck after DB migration. Losing videos to SLAM failures is unacceptable. May need both Yot and Orest on it.",
      owner: "Yoan",
    }),
    goal("Prepare 10 hours of perfect Nvidia sample data with correct distribution", "weekly", "company", {
      reasoning: "First delivery to Nvidia. John can sync by audio. Must be perfect — distribution, quality, everything.",
      owner: "Anton",
    }),
  ];
}
