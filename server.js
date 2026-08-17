const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// In-Memory Storage Fallback
let inMemoryTickets = [];
let dbConnectionString = process.env.DATABASE_URL || '';

// Group Configuration Settings (default: 15 total groups)
let groupConfig = {
  totalGroups: 15
};

function getNeonPool(connStr) {
  if (!connStr) return null;
  try {
    const { neon } = require('@neondatabase/serverless');
    return neon(connStr);
  } catch (err) {
    console.error('Error initializing Neon client:', err.message);
    return null;
  }
}

async function initDb(sql) {
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS tickets (
        id SERIAL PRIMARY KEY,
        name VARCHAR(255) NOT NULL,
        ticket_code VARCHAR(50) UNIQUE NOT NULL,
        group_name VARCHAR(50) NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
      );
    `;
    return true;
  } catch (err) {
    console.error('Neon DB Initialization Error:', err.message);
    return false;
  }
}

function generateRandomTicketCode(prefix = 'TKT', digits = 4) {
  const min = Math.pow(10, digits - 1);
  const max = Math.pow(10, digits) - 1;
  const randomNumber = Math.floor(min + Math.random() * (max - min + 1));
  return `${prefix}-${randomNumber}`;
}

// Calculate Round-Robin Group Assignment based on current total registered count
function getRoundRobinGroup(totalCount, totalGroups) {
  const numGroups = Math.max(parseInt(totalGroups, 10) || 15, 1);
  const groupIndex = (totalCount % numGroups) + 1;
  return `Group ${groupIndex}`;
}

// GET Group Config
app.get('/api/config/group', (req, res) => {
  return res.json({ success: true, totalGroups: groupConfig.totalGroups });
});

// POST Update Group Config
app.post('/api/config/group', (req, res) => {
  const { totalGroups } = req.body;
  const numGroups = parseInt(totalGroups, 10);
  if (numGroups && numGroups > 0) {
    groupConfig.totalGroups = numGroups;
    return res.json({ success: true, totalGroups: groupConfig.totalGroups, message: `Round-robin allocation configured across ${numGroups} total groups.` });
  }
  return res.status(400).json({ success: false, message: 'Invalid total groups number' });
});

// GET Status
app.get('/api/status', async (req, res) => {
  const currentUri = dbConnectionString;
  if (!currentUri) return res.json({ connected: false, mode: 'in-memory' });

  const sql = getNeonPool(currentUri);
  if (!sql) return res.json({ connected: false, mode: 'in-memory' });

  try {
    await initDb(sql);
    const result = await sql`SELECT COUNT(*) FROM tickets;`;
    return res.json({ connected: true, mode: 'neon-db', ticketCount: parseInt(result[0].count, 10) });
  } catch (err) {
    return res.json({ connected: false, mode: 'in-memory' });
  }
});

// GET all tickets
app.get('/api/tickets', async (req, res) => {
  if (dbConnectionString) {
    const sql = getNeonPool(dbConnectionString);
    if (sql) {
      try {
        const rows = await sql`SELECT * FROM tickets ORDER BY id DESC;`;
        return res.json({ success: true, mode: 'neon-db', tickets: rows, totalGroups: groupConfig.totalGroups });
      } catch (err) {
        console.error('Fetch error:', err);
      }
    }
  }
  return res.json({ success: true, mode: 'in-memory', tickets: inMemoryTickets, totalGroups: groupConfig.totalGroups });
});

// POST: Create ticket & assign Round-Robin group
app.post('/api/tickets/create', async (req, res) => {
  const { name, prefix = 'TKT', digits = 4 } = req.body;

  if (!name || !name.trim()) {
    return res.status(400).json({ success: false, message: 'Name is required' });
  }

  const trimmedName = name.trim();
  const digitCount = Math.min(Math.max(parseInt(digits, 10) || 4, 4), 6);

  if (dbConnectionString) {
    const sql = getNeonPool(dbConnectionString);
    if (sql) {
      try {
        await initDb(sql);
        const countRes = await sql`SELECT COUNT(*) FROM tickets;`;
        const totalCount = parseInt(countRes[0].count, 10);
        const assignedGroup = getRoundRobinGroup(totalCount, groupConfig.totalGroups);

        let ticketCode = '';
        let inserted = false;
        let attempts = 0;

        while (!inserted && attempts < 10) {
          attempts++;
          ticketCode = generateRandomTicketCode(prefix.toUpperCase(), digitCount);
          try {
            const result = await sql`
              INSERT INTO tickets (name, ticket_code, group_name)
              VALUES (${trimmedName}, ${ticketCode}, ${assignedGroup})
              RETURNING *;
            `;
            return res.json({ success: true, mode: 'neon-db', ticket: result[0] });
          } catch (insertErr) {
            if (insertErr.code !== '23505') throw insertErr;
          }
        }
      } catch (err) {
        console.error('Neon insert failed, falling back to memory:', err.message);
      }
    }
  }

  // Fallback / In-Memory insertion
  const totalCount = inMemoryTickets.length;
  const assignedGroup = getRoundRobinGroup(totalCount, groupConfig.totalGroups);

  let ticketCode = '';
  let unique = false;
  let attempts = 0;
  while (!unique && attempts < 20) {
    attempts++;
    ticketCode = generateRandomTicketCode(prefix.toUpperCase(), digitCount);
    unique = !inMemoryTickets.some(t => t.ticket_code === ticketCode);
  }

  const newTicket = {
    id: Date.now(),
    name: trimmedName,
    ticket_code: ticketCode,
    group_name: assignedGroup,
    created_at: new Date().toISOString()
  };

  inMemoryTickets.unshift(newTicket);
  return res.json({ success: true, mode: 'in-memory', ticket: newTicket });
});

// DELETE a ticket
app.delete('/api/tickets/:id', async (req, res) => {
  const { id } = req.params;
  if (dbConnectionString) {
    const sql = getNeonPool(dbConnectionString);
    if (sql) {
      try {
        await sql`DELETE FROM tickets WHERE id = ${id};`;
        return res.json({ success: true, message: 'Ticket deleted from Neon DB' });
      } catch (err) {
        console.error('Delete error:', err);
      }
    }
  }

  inMemoryTickets = inMemoryTickets.filter(t => String(t.id) !== String(id));
  return res.json({ success: true, message: 'Ticket deleted' });
});

// CLEAR ALL tickets
app.delete('/api/tickets', async (req, res) => {
  if (dbConnectionString) {
    const sql = getNeonPool(dbConnectionString);
    if (sql) {
      try {
        await sql`TRUNCATE TABLE tickets;`;
        return res.json({ success: true, message: 'All tickets cleared from Neon DB' });
      } catch (err) {
        console.error('Clear error:', err);
      }
    }
  }

  inMemoryTickets = [];
  return res.json({ success: true, message: 'All tickets cleared' });
});

// Serve static frontend files
app.use(express.static(path.join(__dirname, 'public')));

// Catch-all route handler for client-side SPA routing
app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
