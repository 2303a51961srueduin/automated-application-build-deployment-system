function recordActivity(db, userId, action, details = {}) {
  db.prepare('INSERT INTO activity_logs (user_id, action, details) VALUES (?, ?, ?)')
    .run(userId || null, action, JSON.stringify(details));
}

module.exports = { recordActivity };
