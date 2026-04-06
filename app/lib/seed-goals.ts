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
    userId: null,
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
    approved: true,
    proposedBy: null,
    workstream: opts.workstream || null,
    targetDate: opts.targetDate || null,
    estimatedHours: opts.estimatedHours || null,
    createdAt: now,
    updatedAt: now,
  };
}

export function getSeedGoals(): Goal[] {
  return [
    // ===== 5 YEAR — TERMINAL VISION =====
    goal("Become the world's leading robotic deployment company", "5y", "company", {
      pinned: true,
      reasoning: "Terminal value of the business. Not just data — deployment. Own the full stack from data to robots in the field.",
      owner: "Bercan",
    }),
    goal("50M+ people on the platform globally", "5y", "company", {
      reasoning: "Massive scale of contributors, annotators, operators. The platform IS the moat — network effects at scale.",
    }),
    goal("Hundreds of thousands of B2B partnerships globally", "5y", "company", {
      reasoning: "Factories, hotels, logistics, retail — every partnership is a deployment site. Lock in the physical world.",
    }),
    goal("Dominate European robotic deployments", "5y", "company", {
      pinned: true,
      reasoning: "Europe is home market. High labor costs = highest ROI for automation. First mover wins the continent.",
      owner: "Bercan",
    }),
    goal("Own frontier robotic models — SOTA or near-SOTA", "5y", "company", {
      reasoning: "Can't be a deployment company without your own models. Research team must ship world-class embodied AI.",
    }),
    goal("Deploy own robots in European factories and logistics", "5y", "company", {
      reasoning: "End game: we don't just collect data and sell — we deploy robots ourselves using our data advantage.",
    }),

    // ===== 2 YEAR =====
    goal("Dominant European data collection network across 10+ countries", "2y", "company", {
      pinned: true,
      reasoning: "European data is the core differentiator. Build collection culture where none exists. First mover advantage.",
      owner: "Bercan",
    }),
    goal("Scale to 100K+ hours of multi-modal European data", "2y", "company", {
      reasoning: "Scale matters for pre-training. Need stereo, audio, depth, tactile — not just mono RGB.",
    }),
    goal("Launch Shift glasses product at scale", "2y", "company", {
      reasoning: "Own hardware = own the data pipeline. Stereo depth + audio from our own device.",
      owner: "Anton",
    }),
    goal("5+ recurring lab contracts (GDM, Nvidia, Figure, Skilled, Robco tier)", "2y", "company", {
      reasoning: "Recurring revenue from top labs. Proves product-market fit and funds European expansion.",
    }),
    goal("First robotic deployment partnerships in European factories", "2y", "company", {
      reasoning: "Start deployment early. Even small pilots = learning + lock-in + investor narrative.",
    }),
    goal("Build research team with frontier model capability", "2y", "company", {
      reasoning: "Need 3-5 world-class ML researchers. Models trained on our unique European multi-modal data.",
    }),

    // ===== 1 YEAR =====
    goal("Europe becomes primary collection region (>70% of hours)", "1y", "company", {
      pinned: true,
      reasoning: "Indian mono data saturating. European data commands premium. Figure confirmed European preference.",
      owner: "Bercan",
    }),
    goal("Exit India for low-quality collection — keep only high-quality environments on own devices", "1y", "company", {
      reasoning: "70+ competitors in India, race to bottom. Only keep stereo collection in high-value environments.",
      status: "in_progress",
    }),
    goal("Launch mobile app collection at scale across Europe and Turkey", "1y", "company", {
      reasoning: "iPhone stereo from 16+ is scalable. Top-of-funnel for platform. Turkey builds collection culture.",
      status: "in_progress",
      owner: "Anton",
    }),
    goal("Close Series A funding", "1y", "company", {
      reasoning: "Need capital to scale European ops, hire research team, build hardware. Strong positioning with European data thesis.",
      owner: "Bercan",
    }),
    goal("Hire senior European ops lead + B2B sales for factory partnerships", "1y", "company", {
      reasoning: "Need someone with credibility to open factory doors in Germany. Richard transitioning to Europe.",
    }),
    goal("Annotation product inside the app as second revenue stream", "1y", "company", {
      reasoning: "Unique: collectors annotate their own data. Quality signal no competitor has. Extra revenue per user.",
      owner: "Anton",
    }),
    goal("Establish tactile data capability via partner or own R&D", "1y", "company", {
      reasoning: "Tactile is 12-18 months from serious demand. Need gloves ready when market arrives.",
    }),

    // ===== 6 MONTH =====
    goal("Deliver Google DeepMind contract successfully", "6m", "company", {
      pinned: true,
      status: "in_progress",
      reasoning: "Anchor customer. Pipeline output quality and volume are critical. Good delivery = reference for everything.",
      owner: "Anton",
    }),
    goal("Win Nvidia data contract", "6m", "company", {
      pinned: true,
      reasoning: "Nvidia contract = massive revenue + validation. Be 1 of 5 selected.",
      owner: "Bercan",
    }),
    goal("Scale European mobile collection to 1000+ contributors", "6m", "company", {
      reasoning: "Germany, Turkey, Bulgaria initial focus. Critical mass for diverse environments.",
      owner: "Richard",
    }),
    goal("Fix pipeline bottlenecks: SLAM, ingress, session orchestrator", "6m", "company", {
      status: "in_progress",
      reasoning: "SLAM failures lose videos. Ingress needs external device support. Primary technical blockers.",
      owner: "Nico",
    }),
    goal("Develop cheap stereo device (<$100) for partner collection", "6m", "company", {
      reasoning: "Partners in India/Turkey collect stereo if device is cheap. SD card + phone. Much higher value than mono.",
    }),
    goal("Launch public brand presence — X, LinkedIn, press", "6m", "company", {
      reasoning: "Create buzz before competitors dominate mindshare. VCs and labs reach out proactively.",
      owner: "Bercan",
    }),
    goal("Close Robco + 2 additional non-exclusive deals", "6m", "company", {
      reasoning: "Non-exclusive model works if quality is top-notch. Sell same data to 6-7 companies.",
      owner: "Bercan",
    }),
    goal("Evaluate and decide on Open Graph Labs partnership", "6m", "company", {
      reasoning: "Camera sync infra + tactile glove hedge + Nvidia connections. $250K. Need tech due diligence first.",
      owner: "Bercan",
    }),
    goal("Shift Richard from India to Europe", "6m", "company", {
      reasoning: "Richard has ops experience. Europe needs boots on the ground. India can run on autopilot with local partners.",
      owner: "Anton",
    }),

    // ===== MONTHLY =====
    goal("Finalize 6-month strategy document with backwards-engineered goals", "monthly", "company", {
      pinned: true,
      status: "in_progress",
      reasoning: "Team lacks clarity on direction. Strategy must be written, visual, usable in every meeting.",
      owner: "Bercan",
    }),
    goal("Integrate external device data into pipeline", "monthly", "company", {
      status: "in_progress",
      reasoning: "Handle timestamps, user IDs, foreign keys for built device data. Nico estimated 1 week.",
      owner: "Nico",
    }),
    goal("Set fundraising preparation date — target April 20", "monthly", "company", {
      reasoning: "4 weeks to prepare: customer substance, public launch, investor materials.",
      owner: "Bercan",
    }),
    goal("Schedule tech due diligence with Open Graph Labs", "monthly", "company", {
      reasoning: "Before any investment. Need live demo, understand APIs, evaluate tactile roadmap.",
      owner: "Yoan",
    }),

    // ===== WEEKLY =====
    goal("Deliver Google DeepMind — QA check and pipeline output this week", "weekly", "company", {
      pinned: true,
      status: "in_progress",
      reasoning: "Delivery is in 2 weeks. This week is critical for QA and pipeline throughput.",
      owner: "Anton",
    }),
    goal("Write 6-month strategy doc — first draft by Wednesday", "weekly", "company", {
      status: "in_progress",
      reasoning: "Committed to Artjem. Pen and paper first, then digital. Include reasoning for each goal.",
      owner: "Bercan",
    }),
    goal("Get India custom data through pipeline", "weekly", "company", {
      status: "in_progress",
      reasoning: "Vary user IDs, handle 3-4hr recordings, filter build device footage.",
      owner: "Daniel",
    }),
    goal("Talk to Richard about Europe transition timeline", "weekly", "company", {
      reasoning: "Don't force immediate move. Ask what's reasonable. He sent India hiring list — needs to understand shift.",
      owner: "Anton",
    }),
    goal("Fix Android upside-down video bug", "weekly", "company", {
      reasoning: "Bad look for data quality. Quick fix needed before next batch.",
      owner: "Anton",
    }),
    goal("Prioritize SLAM — assign both Yot and Orest", "weekly", "company", {
      reasoning: "SLAM is primary bottleneck after DB migration. Losing videos is unacceptable.",
      owner: "Yoan",
    }),
    goal("Prepare 10 hours perfect Nvidia sample data", "weekly", "company", {
      reasoning: "First delivery to Nvidia. John syncs by audio. Must be perfect distribution and quality.",
      owner: "Anton",
    }),
  ];
}
