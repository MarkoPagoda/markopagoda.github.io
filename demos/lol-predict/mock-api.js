
(function () {
  "use strict";

  // SAMPLE DATA

  const ROLES = ["TOP", "JUNGLE", "MIDDLE", "BOTTOM", "UTILITY"];

  // The journal page stores picks as "blue_top", "red_mid" and so on
  const SLOT = { TOP: "top", JUNGLE: "jungle", MIDDLE: "mid", BOTTOM: "bot", UTILITY: "support" };

  const POOLS = {
    TOP:     ["Aatrox", "Camille", "Ornn", "Jax", "K'Sante", "Gnar", "Renekton", "Sion", "Fiora", "Malphite", "Gwen", "Jayce"],
    JUNGLE:  ["Lee Sin", "Viego", "Sejuani", "Vi", "Nidalee", "Elise", "Maokai", "Jarvan IV", "Xin Zhao", "Rek'Sai", "Kindred", "Wukong"],
    MIDDLE:  ["Ahri", "Azir", "Syndra", "Orianna", "Viktor", "Corki", "Taliyah", "Sylas", "Yone", "Cassiopeia", "Anivia", "LeBlanc"],
    BOTTOM:  ["Jinx", "Kai'Sa", "Ezreal", "Aphelios", "Varus", "Xayah", "Caitlyn", "Lucian", "Zeri", "Sivir", "Ashe", "Miss Fortune"],
    UTILITY: ["Nautilus", "Rakan", "Lulu", "Alistar", "Thresh", "Leona", "Karma", "Renata Glasc", "Braum", "Milio", "Yuumi", "Rell"]
  };

  // Invented team strengths (log-odds), NOT real measurements
  const TEAMS = [
    { team: "T1",                  league: "LCK", rating:  0.62 },
    { team: "Gen.G",               league: "LCK", rating:  0.71 },
    { team: "Hanwha Life Esports", league: "LCK", rating:  0.40 },
    { team: "Dplus KIA",           league: "LCK", rating:  0.12 },
    { team: "G2 Esports",          league: "LEC", rating:  0.48 },
    { team: "Fnatic",              league: "LEC", rating:  0.30 },
    { team: "Karmine Corp",        league: "LEC", rating:  0.21 },
    { team: "Team Vitality",       league: "LEC", rating: -0.05 },
    { team: "Bilibili Gaming",     league: "LPL", rating:  0.58 },
    { team: "JD Gaming",           league: "LPL", rating:  0.44 },
    { team: "Top Esports",         league: "LPL", rating:  0.09 },
    { team: "Cloud9",              league: "LCS", rating:  0.15 },
    { team: "Team Liquid",         league: "LCS", rating:  0.08 },
    { team: "FlyQuest",            league: "LCS", rating: -0.10 }
  ];

  // Rough league strength used only for cross-league matchups
  const LEAGUE_OFFSET = { LCK: 0.15, LPL: 0.15, LEC: 0.0, LCS: -0.2 };

  // TODO: replace with the real held-out scores from your model
  const PRO_METRICS = {
    roc_auc: 0.712,
    accuracy: 0.661,
    baseline_accuracy: 0.527,
    roc_auc_team_only: 0.698,
    roc_auc_draft_only: 0.561,
    mean_abs_deviation: 0.041
  };

  const SIDE_LOGIT = 0.12;   // small fixed advantage for blue side

  //FAKE MODEL

  // Turns a string into a stable number between 0 and 1, so the same champion
  // always gets the same rating.
  function hash(text) {
    let h = 2166136261;
    for (const char of text) {
      h ^= char.charCodeAt(0);
      h = Math.imul(h, 16777619);
    }
    return (h >>> 0) / 4294967295;
  }

  const sigmoid = (x) => 1 / (1 + Math.exp(-x));

  function champInfo(champion, role, side) {
    const known = POOLS[role].includes(champion);
    const rating = known ? (hash(role + champion + "rating") - 0.5) * 0.36 : 0;
    const games = known ? Math.round(150 + hash(role + champion + "games") ** 2 * 9000) : 0;
    return {
      champion, role, side, known,
      rating,
      contribution: side === "blue" ? rating : -rating,   // signed toward blue, like the real API
      scaling: known ? (hash(role + champion + "scaling") - 0.5) * 2 : 0,
      winrate: known ? 0.5 + rating * 0.25 : 0.5,
      games,
      low_sample: known && games < 400
    };
  }

  function rosterFor(team) {
    // Five invented player ratings that add up to the team rating
    const names = ["Top", "Jungle", "Mid", "Bot", "Support"];
    const ratings = names.map((name, i) => team.rating / 5 + (hash(team.team + name) - 0.5) * 0.12);
    ratings[4] = team.rating - ratings.slice(0, 4).reduce((a, b) => a + b, 0);
    return { players: names.map((name, i) => ({ name, rating: ratings[i], known: true })) };
  }

  function teamSide(team) {
    return { team: team.team, league: team.league, rating: team.rating, roster: rosterFor(team) };
  }

  function buildPro(blueName, redName, draftLogit) {
    if (!blueName || !redName) return null;
    const blue = TEAMS.find((t) => t.team === blueName);
    const red = TEAMS.find((t) => t.team === redName);
    if (!blue || !red) {
      return { available: false, reason: "unknown_team", detail: "One of these teams is not in the sample data." };
    }
    const cross = blue.league !== red.league;
    const teamLogit = cross
      ? (blue.rating + LEAGUE_OFFSET[blue.league]) - (red.rating + LEAGUE_OFFSET[red.league])
      : blue.rating - red.rating;
    return {
      available: true,
      cross_league: cross,
      league: cross ? null : blue.league,
      blue_team: teamSide(blue),
      red_team: teamSide(red),
      team_logit: teamLogit,
      draft_logit: draftLogit,
      blue_win_probability: sigmoid(teamLogit + draftLogit + SIDE_LOGIT)
    };
  }

  function predict(body) {
    const picks = body.picks || {};
    const byRole = [];
    const pickRows = [];
    let draftLogit = 0;
    let slope = 0;                                   // how much the draft favours blue later in the game

    for (const role of ROLES) {
      const blue = champInfo(picks[`blue_${SLOT[role]}`], role, "blue");
      const red  = champInfo(picks[`red_${SLOT[role]}`],  role, "red");
      const net = blue.contribution + red.contribution;
      draftLogit += net;
      slope += (blue.scaling - red.scaling) * 0.06;
      byRole.push({ role, blue, red, net });
      pickRows.push(blue, red);
    }

    const pro = buildPro(body.blue_team, body.red_team, draftLogit);
    const base = draftLogit + SIDE_LOGIT + (pro && pro.available ? pro.team_logit : 0);

    // Win probability against game length, 15 to 45 minutes
    const curve = [];
    for (let minute = 15; minute <= 45; minute += 1) {
      curve.push({ minute, blue_win_probability: sigmoid(base + slope * ((minute - 30) / 15)) });
    }

    // Find where the curve crosses 50%, if it does
    let crossover = null;
    for (let i = 1; i < curve.length; i++) {
      const a = curve[i - 1].blue_win_probability - 0.5;
      const b = curve[i].blue_win_probability - 0.5;
      if (a === 0 || a * b < 0) {
        crossover = curve[i - 1].minute + (Math.abs(a) / (Math.abs(a) + Math.abs(b))) * 1;
        break;
      }
    }

    return {
      blue_win_probability: sigmoid(draftLogit + SIDE_LOGIT),
      draft_logit: draftLogit,
      side_logit: SIDE_LOGIT,
      by_role: byRole,
      picks: pickRows,
      curve,
      crossover_minute: crossover,
      pro
    };
  }

  function meta() {
    return {
      roles: ROLES,
      columns: ROLES.flatMap((role) => ["blue", "red"].map((side) => ({ side, role, column: `${side}_${SLOT[role]}` }))),
      champions: Object.fromEntries(ROLES.map((role) => [role, POOLS[role].map((champion) => ({ champion }))])),
      teams: TEAMS,
      pro_metrics: PRO_METRICS,
      metrics: { demo: { roc_auc: 0.55, accuracy: 0.54, baseline_accuracy: 0.51, log_loss: 0.69 } },
      best_variant: "demo"
    };
  }

  // JOURNAL (kept in localStorage)

  const STORAGE_KEY = "lol-predict-demo-journal-v1";
  let memoryCopy = null;                             // fallback if localStorage is blocked

  function impliedFrom(oddsBlue, oddsRed) {
    if (!oddsBlue || !oddsRed || oddsBlue <= 1 || oddsRed <= 1) return null;
    const rb = 1 / oddsBlue, rr = 1 / oddsRed, over = rb + rr;
    return { fair_blue: rb / over, margin: over - 1 };
  }

  // A few example entries so the journal is not empty on first visit
  function seedJournal() {
    const pickAt = (n) => {
      const picks = {};
      ROLES.forEach((role, i) => {
        picks[`blue_${SLOT[role]}`] = POOLS[role][(n + i * 3) % POOLS[role].length];
        picks[`red_${SLOT[role]}`]  = POOLS[role][(n * 5 + i * 2 + 1) % POOLS[role].length];
      });
      return picks;
    };

    const samples = [
      { label: "Sample 1", blue: "T1", red: "Gen.G", ob: 2.05, or: 1.75, mine: "blue", winner: "blue" },
      { label: "Sample 2", blue: "G2 Esports", red: "Fnatic", ob: 1.55, or: 2.45, mine: "blue", winner: "red" },
      { label: "Sample 3", blue: "JD Gaming", red: "Bilibili Gaming", ob: 1.9, or: 1.9, mine: "red", winner: "red" },
      { label: "Sample 4", blue: "Dplus KIA", red: "Hanwha Life Esports", ob: null, or: null, mine: null, winner: null }
    ];

    const entries = samples.map((s, i) => {
      const picks = pickAt(i + 1);
      const result = predict({ picks, blue_team: s.blue, red_team: s.red });
      const usingPro = result.pro && result.pro.available;
      return {
        id: i + 1,
        created_at: new Date(Date.now() - (samples.length - i) * 86400000).toISOString(),
        kind: "real",
        label: s.label,
        league: usingPro ? result.pro.league : null,
        blue_team: s.blue,
        red_team: s.red,
        picks,
        model_probability: usingPro ? result.pro.blue_win_probability : result.blue_win_probability,
        draft_logit: result.draft_logit,
        team_logit: usingPro ? result.pro.team_logit : null,
        model_version: usingPro ? "pro" : "draft-only",
        odds_blue: s.ob,
        odds_red: s.or,
        implied: impliedFrom(s.ob, s.or),
        user_pick: s.mine,
        actual_winner: s.winner,
        notes: "Demo seed entry, not a real result."
      };
    });
    return { nextId: entries.length + 1, entries };
  }

  function loadJournal() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (error) { /* blocked or corrupt: fall through */ }
    return memoryCopy || seedJournal();
  }

  function saveJournal(journal) {
    memoryCopy = journal;
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(journal)); } catch (error) { /* ignore */ }
  }

  const mean = (list) => (list.length ? list.reduce((a, b) => a + b, 0) / list.length : 0);

  function summarize(entries) {
    const outcome = (e) => (e.actual_winner === "blue" ? 1 : 0);
    const modelSide = (e) => (e.model_probability >= 0.5 ? "blue" : "red");
    const resolved = entries.filter((e) => e.kind === "real" && e.actual_winner);
    const scored = resolved.filter((e) => e.model_probability != null);
    const mine = scored.filter((e) => e.user_pick);
    const withOdds = scored.filter((e) => e.implied);

    return {
      n_entries: entries.length,
      n_resolved: resolved.length,
      n_fantasy: entries.filter((e) => e.kind === "fantasy").length,
      model_accuracy: mean(scored.map((e) => (modelSide(e) === e.actual_winner ? 1 : 0))),
      model_brier: mean(scored.map((e) => (e.model_probability - outcome(e)) ** 2)),
      n_user_picks: mine.length,
      user_accuracy: mean(mine.map((e) => (e.user_pick === e.actual_winner ? 1 : 0))),
      model_accuracy_on_user_subset: mean(mine.map((e) => (modelSide(e) === e.actual_winner ? 1 : 0))),
      user_agreed_with_model: mean(mine.map((e) => (e.user_pick === modelSide(e) ? 1 : 0))),
      n_with_odds: withOdds.length,
      market_brier: mean(withOdds.map((e) => (e.implied.fair_blue - outcome(e)) ** 2)),
      model_brier_on_odds_subset: mean(withOdds.map((e) => (e.model_probability - outcome(e)) ** 2)),
      mean_margin: mean(withOdds.map((e) => e.implied.margin))
    };
  }

  // FETCH INTERCEPTOR

  const realFetch = window.fetch ? window.fetch.bind(window) : null;

  const reply = (data, status = 200) =>
    new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });

  window.fetch = async function (input, init = {}) {
    const url = new URL(typeof input === "string" ? input : input.url, location.href);

    // Anything that is not an /api/ call goes to the network as normal
    if (!url.pathname.startsWith("/api/")) return realFetch(input, init);

    await new Promise((resolve) => setTimeout(resolve, 40));   // tiny delay so it feels like a request

    const method = (init.method || "GET").toUpperCase();
    const body = init.body ? JSON.parse(init.body) : {};
    const path = url.pathname;

    if (path === "/api/meta" && method === "GET") return reply(meta());
    if (path === "/api/predict" && method === "POST") return reply(predict(body));

    if (path === "/api/journal" && method === "GET") {
      const journal = loadJournal();
      const kind = url.searchParams.get("kind");
      const entries = journal.entries
        .filter((e) => !kind || e.kind === kind)
        .sort((a, b) => b.id - a.id);
      saveJournal(journal);                                    // persists the seed on first visit
      return reply({ entries, summary: summarize(journal.entries) });
    }

    if (path === "/api/journal" && method === "POST") {
      const journal = loadJournal();
      const entry = {
        ...body,
        id: journal.nextId++,
        created_at: new Date().toISOString(),
        actual_winner: null,
        implied: impliedFrom(body.odds_blue, body.odds_red)
      };
      journal.entries.push(entry);
      saveJournal(journal);
      return reply({ id: entry.id });
    }

    const match = path.match(/^\/api\/journal\/(\d+)$/);
    if (match) {
      const id = Number(match[1]);
      const journal = loadJournal();
      if (method === "PATCH") {
        const entry = journal.entries.find((e) => e.id === id);
        if (!entry) return reply({ detail: "Not found" }, 404);
        Object.assign(entry, body);
      } else if (method === "DELETE") {
        journal.entries = journal.entries.filter((e) => e.id !== id);
      }
      saveJournal(journal);
      return reply({ ok: true });
    }

    return reply({ detail: "Not found in demo API" }, 404);
  };

  // "SAMPLE DATA" BANNER 

  document.addEventListener("DOMContentLoaded", () => {
    const bar = document.createElement("div");
    bar.textContent = "Portfolio demo: sample data, no server. Predictions are simulated in your browser.";
    bar.style.cssText = "position:sticky;top:0;z-index:50;padding:6px 12px;font:12px system-ui,sans-serif;text-align:center;background:#fff4d6;color:#5a4300;border-bottom:1px solid #e8d49a";
    document.body.prepend(bar);
  });
})();
