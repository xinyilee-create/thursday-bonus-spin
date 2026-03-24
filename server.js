const express = require("express");
const path = require("path");
const { Pool } = require("pg");

const PORT = Number(process.env.PORT || 3000);
const MAX_SPINS = 10;
const JACKPOT = 500;
const SYMBOLS = ["🍒", "🍋", "🔔", "💎", "7", "⭐"];

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const pool = new Pool({
  host: process.env.DB_HOST || process.env.PGHOST,
  port: Number(process.env.DB_PORT || process.env.PGPORT || 5432),
  database: process.env.DB_NAME || process.env.PGDATABASE,
  user: process.env.DB_USER || process.env.PGUSER,
  password: process.env.DB_PASSWORD || process.env.PGPASSWORD,
  ssl: false,
});

app.get("/health", async (_req, res) => {
  try {
    await pool.query("select 1");
    res.json({ ok: true });
  } catch (error) {
    res.status(500).json({ ok: false, error: "db_unavailable" });
  }
});

app.get("/api/leaderboard", async (_req, res) => {
  const leaderboard = await getLeaderboard();
  res.json({ leaderboard });
});

app.get("/api/admin/participants", async (_req, res) => {
  const result = await pool.query(`
    select
      id,
      player_name as name,
      score,
      spins_used,
      registered_at,
      completed_at
    from anchor_day_players
    order by registered_at asc, id asc
  `);

  res.json({
    participants: result.rows.map((row, index) => ({
      order: index + 1,
      ...row,
    })),
  });
});

app.post("/api/register", async (req, res) => {
  const name = normalizeName(req.body?.name);
  if (!name) {
    return res.status(400).json({ error: "missing_name" });
  }

  await pool.query(
    `
      insert into anchor_day_players (player_name)
      values ($1)
      on conflict (player_name) do nothing
    `,
    [name]
  );

  const player = await getPlayer(name);
  const leaderboard = await getLeaderboard();
  return res.json({ player, leaderboard, maxSpins: MAX_SPINS });
});

app.post("/api/spin", async (req, res) => {
  const name = normalizeName(req.body?.name);
  if (!name) {
    return res.status(400).json({ error: "missing_name" });
  }

  const client = await pool.connect();
  try {
    await client.query("begin");

    const playerResult = await client.query(
      `
        select *
        from anchor_day_players
        where player_name = $1
        for update
      `,
      [name]
    );

    if (!playerResult.rows.length) {
      await client.query("rollback");
      return res.status(404).json({ error: "player_not_found" });
    }

    const player = playerResult.rows[0];
    if (player.spins_used >= MAX_SPINS) {
      await client.query("rollback");
      const leaderboard = await getLeaderboard();
      return res.status(409).json({
        error: "no_spins_left",
        player: mapPlayer(player),
        leaderboard,
        maxSpins: MAX_SPINS,
      });
    }

    const results = rollSpinResult();
    const outcome = evaluateSpin(results);
    const nextSpinsUsed = player.spins_used + 1;
    const nextScore = player.score + outcome.win;
    const completedAt = nextSpinsUsed >= MAX_SPINS && !player.completed_at ? new Date() : player.completed_at;

    await client.query(
      `
        update anchor_day_players
        set
          score = $2,
          spins_used = $3,
          completed_at = $4
        where player_name = $1
      `,
      [name, nextScore, nextSpinsUsed, completedAt]
    );

    await client.query("commit");

    const updatedPlayer = await getPlayer(name);
    const leaderboard = await getLeaderboard();
    return res.json({
      results,
      outcome,
      player: updatedPlayer,
      leaderboard,
      maxSpins: MAX_SPINS,
    });
  } catch (error) {
    await client.query("rollback");
    console.error(error);
    return res.status(500).json({ error: "spin_failed" });
  } finally {
    client.release();
  }
});

app.get("*", (_req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

init()
  .then(() => {
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`Anchor Day加菜賽 listening on ${PORT}`);
    });
  })
  .catch((error) => {
    console.error("Failed to initialize app", error);
    process.exit(1);
  });

async function init() {
  await pool.query(`
    create table if not exists anchor_day_players (
      id serial primary key,
      player_name text not null unique,
      score integer not null default 0,
      spins_used integer not null default 0,
      registered_at timestamptz not null default now(),
      completed_at timestamptz
    )
  `);
}

async function getPlayer(name) {
  const result = await pool.query(
    `
      select *
      from anchor_day_players
      where player_name = $1
    `,
    [name]
  );
  return result.rows.length ? mapPlayer(result.rows[0]) : null;
}

async function getLeaderboard() {
  const result = await pool.query(`
    select
      id,
      player_name as name,
      score,
      spins_used,
      registered_at,
      completed_at
    from anchor_day_players
    order by
      score desc,
      completed_at asc nulls last,
      registered_at asc,
      id asc
  `);

  return result.rows.map((row, index) => ({
    rank: index + 1,
    ...row,
  }));
}

function mapPlayer(row) {
  return {
    id: row.id,
    name: row.player_name,
    score: row.score,
    spinsUsed: row.spins_used,
    registeredAt: row.registered_at,
    completedAt: row.completed_at,
  };
}

function normalizeName(value) {
  return typeof value === "string" ? value.trim() : "";
}

function randomSymbol() {
  return SYMBOLS[Math.floor(Math.random() * SYMBOLS.length)];
}

function randomNonStarSymbol() {
  const pool = SYMBOLS.filter((symbol) => symbol !== "⭐");
  return pool[Math.floor(Math.random() * pool.length)];
}

function randomDifferentNonStarSymbol(excluded) {
  const pool = SYMBOLS.filter((symbol) => symbol !== "⭐" && symbol !== excluded);
  return pool[Math.floor(Math.random() * pool.length)];
}

function shuffle(items) {
  const list = [...items];
  for (let index = list.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [list[index], list[swapIndex]] = [list[swapIndex], list[index]];
  }
  return list;
}

function rollSpinResult() {
  const roll = Math.random();

  if (roll < 0.04) {
    return ["⭐", "⭐", "⭐"];
  }

  if (roll < 0.2) {
    const symbol = randomNonStarSymbol();
    return [symbol, symbol, symbol];
  }

  if (roll < 0.45) {
    const symbol = randomNonStarSymbol();
    return shuffle([symbol, symbol, "⭐"]);
  }

  if (roll < 0.75) {
    const symbol = randomNonStarSymbol();
    const other = randomDifferentNonStarSymbol(symbol);
    return shuffle([symbol, symbol, other]);
  }

  return [randomSymbol(), randomSymbol(), randomSymbol()];
}

function evaluateSpin(results) {
  const stars = results.filter((item) => item === "⭐").length;
  const counts = results.reduce((map, symbol) => {
    map[symbol] = (map[symbol] || 0) + 1;
    return map;
  }, {});

  if (stars === 3) {
    return {
      win: JACKPOT,
      message: "JACKPOT! 三顆星星全中！",
      winningSymbols: ["⭐"],
    };
  }

  const pureMatch = Object.entries(counts).find(([symbol, count]) => symbol !== "⭐" && count === 3);
  if (pureMatch) {
    return {
      win: 80,
      message: `${pureMatch[0]} 三連線，中獎 80 金幣！`,
      winningSymbols: [pureMatch[0]],
    };
  }

  const twoPlusStar = Object.entries(counts).find(([symbol, count]) => symbol !== "⭐" && count === 2 && stars === 1);
  if (twoPlusStar) {
    return {
      win: 40,
      message: "星星補位成功，中獎 40 金幣！",
      winningSymbols: [twoPlusStar[0], "⭐"],
    };
  }

  const plainPair = Object.entries(counts).find(([symbol, count]) => symbol !== "⭐" && count === 2 && stars === 0);
  if (plainPair) {
    return {
      win: 20,
      message: `${plainPair[0]} 兩個相同，中獎 20 金幣！`,
      winningSymbols: [plainPair[0]],
    };
  }

  return {
    win: 0,
    message: "這次沒有連線，再試一次。",
    winningSymbols: [],
  };
}
