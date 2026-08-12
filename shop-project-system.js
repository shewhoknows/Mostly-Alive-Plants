export const SHOP_PROJECT_STATE_VERSION = 1;
export const SHOP_PROJECT_START_WEEK = 3;

export const SHOP_PROJECTS = Object.freeze([
  Object.freeze({
    id: "window-garland",
    title: "Window Garland",
    copy: "Frame the front window with a soft trail of leaves and warm lights.",
    objectName: "project-window-garland",
    message: "The window garland makes the shop glow from the street.",
    color: "#9fbd78",
  }),
  Object.freeze({
    id: "community-board",
    title: "Community Board",
    copy: "Add a friendly board for plant swaps, care notes, and local news.",
    objectName: "project-community-board",
    message: "The community board is ready for notes from the neighborhood.",
    color: "#d8a56f",
  }),
  Object.freeze({
    id: "hanging-garden",
    title: "Hanging Garden",
    copy: "Grow a small green canopy above the busiest part of the shop.",
    objectName: "project-hanging-garden",
    message: "The new hanging garden adds a lush layer above the shop floor.",
    color: "#6f9b73",
  }),
  Object.freeze({
    id: "painted-pots",
    title: "Painted Pots",
    copy: "Display a bright set of hand-painted pots near the care bench.",
    objectName: "project-painted-pots",
    message: "The painted pots add color and character to the shop.",
    color: "#df846e",
  }),
  Object.freeze({
    id: "reading-corner",
    title: "Plant Reading Corner",
    copy: "Make a calm corner with a chair, a lamp, and useful plant books.",
    objectName: "project-reading-corner",
    message: "The plant reading corner is open for slow and quiet visits.",
    color: "#8496bd",
  }),
]);

const PROJECT_IDS = new Set(SHOP_PROJECTS.map(({ id }) => id));

function nonNegativeInteger(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(0, Math.floor(number)) : fallback;
}

function normalizedWeek(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(1, Math.floor(number)) : 1;
}

function projectDefinitionForWeek(week) {
  if (week < SHOP_PROJECT_START_WEEK) return null;
  const index = (week - SHOP_PROJECT_START_WEEK) % SHOP_PROJECTS.length;
  return SHOP_PROJECTS[index];
}

function entriesFromCounts(value) {
  if (value instanceof Map) return [...value.entries()];
  if (Array.isArray(value)) return value;
  if (value && typeof value === "object") return Object.entries(value);
  return [];
}

function normalizedFundedWeeks(value) {
  const candidates = Array.isArray(value?.fundedWeeks) ? [...value.fundedWeeks] : [];
  if (value?.fundedWeek !== undefined && value?.fundedWeek !== null) {
    candidates.push(value.fundedWeek);
  }

  return [...new Set(candidates
    .map((week) => nonNegativeInteger(week))
    .filter((week) => week >= SHOP_PROJECT_START_WEEK))]
    .sort((left, right) => left - right);
}

export function createDefaultProjectState() {
  return {
    version: SHOP_PROJECT_STATE_VERSION,
    fundedWeeks: [],
    counts: {},
    total: 0,
  };
}

/**
 * Convert missing, legacy, or partial project data to a plain save object.
 * It accepts count objects, Maps, and entry arrays. A legacy fundedWeek value
 * is merged into fundedWeeks. Unknown project ids are removed.
 */
export function migrateProjectState(value) {
  const fundedWeeks = normalizedFundedWeeks(value);
  const counts = {};
  const sourceCounts = value?.counts ?? value?.projectCounts;

  entriesFromCounts(sourceCounts).forEach(([id, count]) => {
    if (!PROJECT_IDS.has(id)) return;
    const normalizedCount = nonNegativeInteger(count);
    if (normalizedCount > 0) counts[id] = normalizedCount;
  });

  // A funded week is direct proof that its weekly project was funded. This
  // keeps old saves consistent when they did not store a separate count map.
  const impliedCounts = {};
  fundedWeeks.forEach((week) => {
    const project = projectDefinitionForWeek(week);
    impliedCounts[project.id] = (impliedCounts[project.id] || 0) + 1;
  });
  Object.entries(impliedCounts).forEach(([id, count]) => {
    counts[id] = Math.max(counts[id] || 0, count);
  });

  return {
    version: SHOP_PROJECT_STATE_VERSION,
    fundedWeeks,
    counts,
    total: Object.values(counts).reduce((sum, count) => sum + count, 0),
  };
}

export function weeklyProjectCost(week) {
  const safeWeek = normalizedWeek(week);
  if (safeWeek < SHOP_PROJECT_START_WEEK) return null;
  const weeksSinceStart = safeWeek - SHOP_PROJECT_START_WEEK;
  return {
    coins: Math.min(180, 60 + 15 * weeksSinceStart),
    bloom: Math.min(45, 15 + 3 * weeksSinceStart),
  };
}

/**
 * Get the fixed project for a week. The optional state adds save-based status
 * without changing the supplied state.
 */
export function projectForWeek(week, projectState) {
  const safeWeek = normalizedWeek(week);
  const definition = projectDefinitionForWeek(safeWeek);
  if (!definition) return null;
  const state = migrateProjectState(projectState);

  return {
    ...definition,
    week: safeWeek,
    cost: weeklyProjectCost(safeWeek),
    funded: state.fundedWeeks.includes(safeWeek),
    count: state.counts[definition.id] || 0,
  };
}

function fundingResult({ ok, code, message, week, projectState, coins, bloom }) {
  return {
    ok,
    code,
    project: projectForWeek(week, projectState),
    cost: weeklyProjectCost(week),
    projectState,
    coins,
    bloom,
    message,
  };
}

/**
 * Check whether this week's project can be funded. This function never mutates
 * the supplied state or resource values.
 */
export function validateProjectFunding({
  week,
  projectState,
  coins = 0,
  bloom = 0,
} = {}) {
  const safeWeek = normalizedWeek(week);
  const state = migrateProjectState(projectState);
  const safeCoins = nonNegativeInteger(coins);
  const safeBloom = nonNegativeInteger(bloom);
  const project = projectForWeek(safeWeek, state);

  if (!project) {
    return fundingResult({
      ok: false,
      code: "locked",
      message: `Shop projects unlock in Week ${SHOP_PROJECT_START_WEEK}.`,
      week: safeWeek,
      projectState: state,
      coins: safeCoins,
      bloom: safeBloom,
    });
  }

  if (project.funded) {
    return fundingResult({
      ok: false,
      code: "already-funded",
      message: "You already funded this week's shop project.",
      week: safeWeek,
      projectState: state,
      coins: safeCoins,
      bloom: safeBloom,
    });
  }

  const cost = project.cost;
  if (safeCoins < cost.coins || safeBloom < cost.bloom) {
    const missing = [];
    if (safeCoins < cost.coins) missing.push(`${cost.coins - safeCoins} coins`);
    if (safeBloom < cost.bloom) missing.push(`${cost.bloom - safeBloom} Bloom`);
    return fundingResult({
      ok: false,
      code: "insufficient-resources",
      message: `You need ${missing.join(" and ")} more to fund this project.`,
      week: safeWeek,
      projectState: state,
      coins: safeCoins,
      bloom: safeBloom,
    });
  }

  return fundingResult({
    ok: true,
    code: "ready",
    message: `${project.title} is ready to fund.`,
    week: safeWeek,
    projectState: state,
    coins: safeCoins,
    bloom: safeBloom,
  });
}

/**
 * Fund one weekly project. It spends coins and Bloom once for that week and
 * returns a new serializable project state.
 */
export function fundWeeklyProject(options = {}) {
  const validation = validateProjectFunding(options);
  if (!validation.ok) return validation;

  const { project, cost } = validation;
  const counts = {
    ...validation.projectState.counts,
    [project.id]: (validation.projectState.counts[project.id] || 0) + 1,
  };
  const nextState = {
    version: SHOP_PROJECT_STATE_VERSION,
    fundedWeeks: [...validation.projectState.fundedWeeks, project.week].sort((left, right) => left - right),
    counts,
    total: validation.projectState.total + 1,
  };

  return fundingResult({
    ok: true,
    code: "funded",
    message: project.message,
    week: project.week,
    projectState: nextState,
    coins: validation.coins - cost.coins,
    bloom: validation.bloom - cost.bloom,
  });
}
