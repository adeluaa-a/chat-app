const { Pool } = require("pg");

const pool = new Pool({
    host: "localhost",
    port: 5432,
    database: "chat_db",
    user: "postgres",
    password: "orisorisss305"
});

module.exports = pool;
