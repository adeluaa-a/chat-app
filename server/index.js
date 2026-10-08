const express = require("express");
const http = require("http");
const cors = require("cors");
const { Server } = require("socket.io");
const pool = require("./db");

process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";

require("dotenv").config();

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

const OPENROUTER_URL =
    "https://openrouter.ai/api/v1/chat/completions";

const OPENROUTER_MODEL = "openrouter/free";


const commandDescriptions = {
    перевод: "перевод текста на русский",
    английский: "перевод текста на английский",
    объясни: "объяснение простыми словами",
    план: "структурированный план доклада",
    вопросы: "вопросы к докладу",
    улучши: "улучшение и редактирование текста"
};


function buildHelpText(commands) {
    const lines = [
        "✦ Доступные команды",
        "",
        "Все команды начинаются с !",
        "",
        "!help — показать этот список"
    ];

    for (const row of commands) {
        const description =
            commandDescriptions[row.command] ||
            "AI-команда";

        lines.push(
            `!${row.command} — ${description}`
        );
    }

    return lines.join("\n");
}


const app = express();

app.use(cors());

app.use(express.json());

const adminSessions = new Set();

function generateAdminToken() {
    return (
        Math.random().toString(36).slice(2) +
        Date.now().toString(36)
    );
}



app.post("/api/admin/login", (req, res) => {
    const { password } = req.body;

    if (password !== process.env.ADMIN_PASSWORD) {
        return res.status(401).json({
            error: "Неверный пароль"
        });
    }

    const token = generateAdminToken();

    adminSessions.add(token);

    res.json({
        success: true,
        token
    });
});


function requireAdmin(req, res, next) {
    const token =
        req.headers.authorization?.replace(
            "Bearer ",
            ""
        );

    if (
        !token ||
        !adminSessions.has(token)
    ) {
        return res.status(401).json({
            error: "Требуется авторизация администратора"
        });
    }

    next();
}


app.get(
    "/api/admin/commands",
    requireAdmin,
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT
                    id,
                    command,
                    prompt
                FROM commands
                ORDER BY id
            `);

            res.json(result.rows);
        } catch (error) {
            console.error(
                "Admin get commands error:",
                error
            );

            res.status(500).json({
                error: "Не удалось получить команды"
            });
        }
    }
);

app.post(
    "/api/admin/commands",
    requireAdmin,
    async (req, res) => {
        try {
            const {
                command,
                prompt
            } = req.body;

            if (!command || !prompt) {
                return res.status(400).json({
                    error:
                        "Команда и prompt обязательны"
                });
            }

            const cleanCommand =
                command
                    .trim()
                    .replace(/^!/, "");

            if (!cleanCommand) {
                return res.status(400).json({
                    error: "Введите название команды"
                });
            }

            const result = await pool.query(
                `
                INSERT INTO commands
                    (command, prompt)
                VALUES
                    ($1, $2)
                RETURNING
                    id,
                    command,
                    prompt
                `,
                [
                    cleanCommand,
                    prompt.trim()
                ]
            );

            res.status(201).json(
                result.rows[0]
            );
        } catch (error) {
            console.error(
                "Admin create command error:",
                error
            );

            if (error.code === "23505") {
                return res.status(409).json({
                    error:
                        "Такая команда уже существует"
                });
            }

            res.status(500).json({
                error:
                    "Не удалось добавить команду"
            });
        }
    }
);


app.put(
    "/api/admin/commands/:id",
    requireAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;

            const {
                command,
                prompt
            } = req.body;

            if (!command || !prompt) {
                return res.status(400).json({
                    error:
                        "Команда и prompt обязательны"
                });
            }

            const cleanCommand =
                command
                    .trim()
                    .replace(/^!/, "");

            if (!cleanCommand) {
                return res.status(400).json({
                    error:
                        "Введите название команды"
                });
            }

            const result = await pool.query(
                `
                UPDATE commands
                SET
                    command = $1,
                    prompt = $2
                WHERE id = $3
                RETURNING
                    id,
                    command,
                    prompt
                `,
                [
                    cleanCommand,
                    prompt.trim(),
                    id
                ]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error: "Команда не найдена"
                });
            }

            res.json(result.rows[0]);
        } catch (error) {
            console.error(
                "Admin update command error:",
                error
            );

            if (error.code === "23505") {
                return res.status(409).json({
                    error:
                        "Такая команда уже существует"
                });
            }

            res.status(500).json({
                error:
                    "Не удалось изменить команду"
            });
        }
    }
);


app.delete(
    "/api/admin/commands/:id",
    requireAdmin,
    async (req, res) => {
        try {
            const { id } = req.params;

            const result = await pool.query(
                `
                DELETE FROM commands
                WHERE id = $1
                RETURNING id
                `,
                [id]
            );

            if (result.rows.length === 0) {
                return res.status(404).json({
                    error:
                        "Команда не найдена"
                });
            }

            res.json({
                success: true
            });
        } catch (error) {
            console.error(
                "Admin delete command error:",
                error
            );

            res.status(500).json({
                error:
                    "Не удалось удалить команду"
            });
        }
    }
);


const server = http.createServer(app);


const io = new Server(server, {
    cors: {
        origin: "http://localhost:5173",
        methods: ["GET", "POST"]
    }
});


app.get("/", (req, res) => {
    res.json({
        message: "Chat server is working!"
    });
});


app.get(
    "/api/messages",
    async (req, res) => {
        try {
            const result = await pool.query(`
                SELECT
                    m.*,
                    COALESCE(
                        json_agg(
                            json_build_object(
                                'id', r.id,
                                'nickname', r.nickname,
                                'emoji', r.emoji
                            )
                        ) FILTER (
                            WHERE r.id IS NOT NULL
                        ),
                        '[]'
                    ) AS reactions
                FROM messages m
                LEFT JOIN reactions r
                    ON r.message_id = m.id
                GROUP BY m.id
                ORDER BY m.id ASC
                LIMIT 100
            `);

            res.json(result.rows);
        } catch (error) {
            console.error(
                "Messages error:",
                error
            );

            res.status(500).json({
                error:
                    "Не удалось получить сообщения"
            });
        }
    }
);

app.post(
    "/api/login",
    async (req, res) => {
        try {
            const { nickname } = req.body;

            if (
                !nickname ||
                nickname.trim() === ""
            ) {
                return res.status(400).json({
                    error: "Введите ник"
                });
            }

            const cleanNickname =
                nickname.trim();

            if (
                cleanNickname.length > 50
            ) {
                return res.status(400).json({
                    error:
                        "Ник не должен быть длиннее 50 символов"
                });
            }

            // Проверяем,
            // используется ли ник сейчас
            const existingUser =
                await pool.query(
                    `
                    SELECT *
                    FROM users
                    WHERE nickname = $1
                      AND is_online = TRUE
                    `,
                    [cleanNickname]
                );

            if (
                existingUser.rows.length > 0
            ) {
                return res.status(409).json({
                    error:
                        "Этот ник уже используется. Выберите другой."
                });
            }

            // Проверяем старого пользователя
            const oldUser =
                await pool.query(
                    `
                    SELECT *
                    FROM users
                    WHERE nickname = $1
                    `,
                    [cleanNickname]
                );

            let user;

            if (
                oldUser.rows.length > 0
            ) {
                const result =
                    await pool.query(
                        `
                        UPDATE users
                        SET is_online = TRUE
                        WHERE nickname = $1
                        RETURNING *
                        `,
                        [cleanNickname]
                    );

                user = result.rows[0];
            } else {
                const result =
                    await pool.query(
                        `
                        INSERT INTO users
                            (nickname, is_online)
                        VALUES
                            ($1, TRUE)
                        RETURNING *
                        `,
                        [cleanNickname]
                    );

                user = result.rows[0];
            }

            res.json({
                success: true,
                user: {
                    id: user.id,
                    nickname: user.nickname
                }
            });
        } catch (error) {
            console.error(
                "Login error:",
                error
            );

            res.status(500).json({
                error: "Ошибка сервера"
            });
        }
    }
);


async function askAI(prompt) {
    if (!OPENROUTER_API_KEY) {
        throw new Error(
            "OPENROUTER_API_KEY не настроен"
        );
    }

    const response = await fetch(
        OPENROUTER_URL,
        {
            method: "POST",

            headers: {
                "Content-Type":
                    "application/json",

                "Authorization":
                    `Bearer ${OPENROUTER_API_KEY}`,

                "HTTP-Referer":
                    "http://localhost:5173",

                "X-Title":
                    "Multiuser Chat"
            },

            body: JSON.stringify({
                model:
                    OPENROUTER_MODEL,

                messages: [
                    {
                        role: "user",
                        content: prompt
                    }
                ]
            })
        }
    );

    const data =
        await response.json();

    if (!response.ok) {
        console.error(
            "OpenRouter API error:",
            JSON.stringify(
                data,
                null,
                2
            )
        );

        const errorText =
            data?.error?.message ||
            "Неизвестная ошибка OpenRouter";

        throw new Error(
            `OpenRouter ${response.status}: ${errorText}`
        );
    }

    const answer =
        data?.choices?.[0]?.message?.content;

    if (!answer) {
        console.error(
            "Unexpected OpenRouter response:",
            JSON.stringify(
                data,
                null,
                2
            )
        );

        throw new Error(
            "OpenRouter не вернул текст ответа"
        );
    }

    return answer;
}

io.on(
    "connection",
    async (socket) => {
        const nickname =
            socket.handshake.auth.nickname;

        if (!nickname) {
            socket.disconnect();
            return;
        }

        console.log(
            `User connected: ${nickname}`
        );

        
        try {
            await pool.query(
                `
                UPDATE users
                SET is_online = TRUE
                WHERE nickname = $1
                `,
                [nickname]
            );

            const result =
                await pool.query(
                    `
                    INSERT INTO messages
                        (nickname, text, type)
                    VALUES
                        ($1, $2, 'system')
                    RETURNING *
                    `,
                    [
                        "Система",
                        `${nickname} вошёл в чат`
                    ]
                );

            io.emit("message", {
                ...result.rows[0],
                reactions: []
            });
        } catch (error) {
            console.error(
                "Connection error:",
                error
            );
        }

        
        socket.on(
            "send_message",
            async (text) => {
                try {
                    if (
                        !text ||
                        !text.trim()
                    ) {
                        return;
                    }

                    const cleanText =
                        text.trim();

                   
                    if (
                        cleanText.startsWith("!")
                    ) {
                        const commandWithoutPrefix =
                            cleanText
                                .substring(1)
                                .trim();

                        const firstSpace =
                            commandWithoutPrefix
                                .indexOf(" ");

                        let commandName;
                        let commandText;

                        if (
                            firstSpace === -1
                        ) {
                            commandName =
                                commandWithoutPrefix;

                            commandText = "";
                        } else {
                            commandName =
                                commandWithoutPrefix
                                    .substring(
                                        0,
                                        firstSpace
                                    );

                            commandText =
                                commandWithoutPrefix
                                    .substring(
                                        firstSpace + 1
                                    )
                                    .trim();
                        }

                        const normalizedCommand =
                            commandName.toLowerCase();

                        console.log(
                            `Command received: !${commandName}`
                        );

                       
                        if (
                            normalizedCommand ===
                            "help"
                        ) {
                            const helpResult =
                                await pool.query(`
                                    SELECT
                                        command
                                    FROM commands
                                    ORDER BY id
                                `);

                            const helpText =
                                buildHelpText(
                                    helpResult.rows
                                );

                            const helpMessage =
                                await pool.query(
                                    `
                                    INSERT INTO messages
                                        (nickname, text, type)
                                    VALUES
                                        ($1, $2, 'system')
                                    RETURNING *
                                    `,
                                    [
                                        "Система",
                                        helpText
                                    ]
                                );

                            io.emit(
                                "message",
                                {
                                    ...helpMessage
                                        .rows[0],
                                    reactions: []
                                }
                            );

                            return;
                        }

                        
                        const commandResult =
                            await pool.query(
                                `
                                SELECT
                                    id,
                                    command,
                                    prompt
                                FROM commands
                                WHERE LOWER(command) =
                                      LOWER($1)
                                LIMIT 1
                                `,
                                [commandName]
                            );

                        
                        if (
                            commandResult.rows
                                .length === 0
                        ) {
                            const errorMessage =
                                await pool.query(
                                    `
                                    INSERT INTO messages
                                        (nickname, text, type)
                                    VALUES
                                        ($1, $2, 'system')
                                    RETURNING *
                                    `,
                                    [
                                        "Система",
                                        `Неизвестная команда: !${commandName}. Введите !help`
                                    ]
                                );

                            io.emit(
                                "message",
                                {
                                    ...errorMessage
                                        .rows[0],
                                    reactions: []
                                }
                            );

                            return;
                        }

                        const command =
                            commandResult.rows[0];

                       
                        if (!commandText) {
                            const errorMessage =
                                await pool.query(
                                    `
                                    INSERT INTO messages
                                        (nickname, text, type)
                                    VALUES
                                        ($1, $2, 'system')
                                    RETURNING *
                                    `,
                                    [
                                        "Система",
                                        `Использование: !${command.command} текст`
                                    ]
                                );

                            io.emit(
                                "message",
                                {
                                    ...errorMessage
                                        .rows[0],
                                    reactions: []
                                }
                            );

                            return;
                        }

                        const userCommand =
                            await pool.query(
                                `
                                INSERT INTO messages
                                    (nickname, text, type)
                                VALUES
                                    ($1, $2, 'user')
                                RETURNING *
                                `,
                                [
                                    nickname,
                                    cleanText
                                ]
                            );

                        io.emit(
                            "message",
                            {
                                ...userCommand
                                    .rows[0],
                                reactions: []
                            }
                        );

                        
                        const prompt =
                            command.prompt.replace(
                                "{text}",
                                commandText
                            );

                        console.log(
                            "Prompt sent to OpenRouter:",
                            prompt
                        );

                    

                        const thinkingMessage =
                            await pool.query(
                                `
                                INSERT INTO messages
                                    (nickname, text, type)
                                VALUES
                                    ($1, $2, 'system')
                                RETURNING *
                                `,
                                [
                                    "Система",
                                    "🤖 Бот обрабатывает запрос..."
                                ]
                            );

                        io.emit(
                            "message",
                            {
                                ...thinkingMessage
                                    .rows[0],
                                reactions: []
                            }
                        );


                        const answer =
                            await askAI(prompt);

                        console.log(
                            "OpenRouter answer:",
                            answer
                        );

                        

                        const botMessage =
                            await pool.query(
                                `
                                INSERT INTO messages
                                    (nickname, text, type)
                                VALUES
                                    ($1, $2, 'system')
                                RETURNING *
                                `,
                                [
                                    "Бот",
                                    answer
                                ]
                            );

                       
                        io.emit(
                            "message",
                            {
                                ...botMessage
                                    .rows[0],
                                reactions: []
                            }
                        );

                        return;
                    }

                   

                    const result =
                        await pool.query(
                            `
                            INSERT INTO messages
                                (nickname, text, type)
                            VALUES
                                ($1, $2, 'user')
                            RETURNING *
                            `,
                            [
                                nickname,
                                cleanText
                            ]
                        );

                    io.emit(
                        "message",
                        {
                            ...result.rows[0],
                            reactions: []
                        }
                    );
                } catch (error) {
                    console.error(
                        "Message / AI error:",
                        error
                    );

               

                    try {
                        const errorMessage =
                            await pool.query(
                                `
                                INSERT INTO messages
                                    (nickname, text, type)
                                VALUES
                                    ($1, $2, 'system')
                                RETURNING *
                                `,
                                [
                                    "Система",
                                    "❌ Ошибка при обработке запроса к ИИ."
                                ]
                            );

                        io.emit(
                            "message",
                            {
                                ...errorMessage
                                    .rows[0],
                                reactions: []
                            }
                        );
                    } catch (
                        dbError
                    ) {
                        console.error(
                            "AI error message DB error:",
                            dbError
                        );
                    }
                }
            }
        );


        socket.on(
            "add_reaction",
            async ({
                messageId,
                emoji
            }) => {
                try {
                    if (
                        !messageId ||
                        !emoji
                    ) {
                        return;
                    }

                    const allowedEmojis = [
                        "👍",
                        "❤️",
                        "😂",
                        "😮",
                        "😢",
                        "👏"
                    ];

                    if (
                        !allowedEmojis.includes(
                            emoji
                        )
                    ) {
                        console.log(
                            "Недопустимая реакция:",
                            emoji
                        );

                        return;
                    }

                    const messageExists =
                        await pool.query(
                            `
                            SELECT id
                            FROM messages
                            WHERE id = $1
                            `,
                            [messageId]
                        );

                    if (
                        messageExists.rows
                            .length === 0
                    ) {
                        return;
                    }

                    const result =
                        await pool.query(
                            `
                            INSERT INTO reactions
                                (
                                    message_id,
                                    nickname,
                                    emoji
                                )
                            VALUES
                                ($1, $2, $3)
                            ON CONFLICT
                                (
                                    message_id,
                                    nickname,
                                    emoji
                                )
                            DO NOTHING
                            RETURNING *
                            `,
                            [
                                messageId,
                                nickname,
                                emoji
                            ]
                        );

                    if (
                        result.rows.length === 0
                    ) {
                        return;
                    }

                    const reaction =
                        result.rows[0];

                    console.log(
                        `Reaction: ${nickname} ${emoji} -> message ${messageId}`
                    );

                    io.emit(
                        "reaction_added",
                        reaction
                    );
                } catch (error) {
                    console.error(
                        "Reaction error:",
                        error
                    );
                }
            }
        );


        socket.on(
            "disconnect",
            async () => {
                console.log(
                    `User disconnected: ${nickname}`
                );

                try {
                    await pool.query(
                        `
                        UPDATE users
                        SET is_online = FALSE
                        WHERE nickname = $1
                        `,
                        [nickname]
                    );

                    const result =
                        await pool.query(
                            `
                            INSERT INTO messages
                                (nickname, text, type)
                            VALUES
                                ($1, $2, 'system')
                            RETURNING *
                            `,
                            [
                                "Система",
                                `${nickname} вышел из чата`
                            ]
                        );

                    io.emit(
                        "message",
                        {
                            ...result.rows[0],
                            reactions: []
                        }
                    );
                } catch (error) {
                    console.error(
                        "Disconnect error:",
                        error
                    );
                }
            }
        );
    }
);

pool.query(
    "SELECT NOW()",
    (err, result) => {
        if (err) {
            console.error(
                "Database connection error:",
                err
            );
        } else {
            console.log(
                "Database connected:",
                result.rows[0]
            );
        }
    }
);



server.listen(
    3000,
    async () => {
        try {
            // Все пользователи после перезапуска
            // считаются офлайн
            await pool.query(
                `
                UPDATE users
                SET is_online = FALSE
                `
            );

            console.log(
                "All users marked as offline"
            );

            console.log(
                "Server started on http://localhost:3000"
            );


            const messagesCount =
                await pool.query(
                    `
                    SELECT
                        COUNT(*)::int AS count
                    FROM messages
                    `
                );

            if (
                messagesCount.rows[0].count === 0
            ) {
                const commandsResult =
                    await pool.query(`
                        SELECT
                            command
                        FROM commands
                        ORDER BY id
                    `);

                const welcomeText =
                    buildHelpText(
                        commandsResult.rows
                    );

                const welcomeMessage =
                    await pool.query(
                        `
                        INSERT INTO messages
                            (nickname, text, type)
                        VALUES
                            ($1, $2, 'system')
                        RETURNING *
                        `,
                        [
                            "Система",
                            welcomeText
                        ]
                    );

                console.log(
                    "Initial command help message created:",
                    welcomeMessage.rows[0].id
                );
            }

         

            if (OPENROUTER_API_KEY) {
                console.log(
                    "OpenRouter API key: configured"
                );
            } else {
                console.log(
                    "WARNING: OPENROUTER_API_KEY is not configured"
                );
            }
        } catch (error) {
            console.error(
                "Startup database error:",
                error
            );
        }
    }
);