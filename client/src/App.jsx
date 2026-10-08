import { useEffect, useRef, useState } from "react";
import { io } from "socket.io-client";
import Admin from "./Admin";
import "./App.css";

const SOCKET_URL = "http://localhost:3000";
const REACTIONS = ["👍", "❤️", "😂", "😮", "😢", "👏"];

function AppContent() {
    const [user, setUser] = useState(() => {
        const saved = localStorage.getItem("chatUser");
        return saved ? JSON.parse(saved) : null;
    });
    const [nickname, setNickname] = useState("");
    const [messages, setMessages] = useState([]);
    const [messageText, setMessageText] = useState("");
    const [loginError, setLoginError] = useState("");
    const [loginLoading, setLoginLoading] = useState(false);
    const [openReactionMenu, setOpenReactionMenu] = useState(null);

    const socketRef = useRef(null);
    const messagesEndRef = useRef(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        if (!user) return;

        fetch("http://localhost:3000/api/messages")
            .then((response) => response.json())
            .then(setMessages)
            .catch((error) =>
                console.error("Ошибка загрузки сообщений:", error)
            );
    }, [user]);

    useEffect(() => {
        if (!user) return;

        const socket = io(SOCKET_URL, {
            auth: { nickname: user.nickname }
        });

        socketRef.current = socket;

        socket.on("message", (message) => {
            setMessages((prev) => [...prev, message]);
        });

        socket.on("reaction_added", (reaction) => {
            setMessages((prev) =>
                prev.map((message) =>
                    message.id !== reaction.message_id
                        ? message
                        : {
                              ...message,
                              reactions: [
                                  ...(message.reactions || []),
                                  reaction
                              ]
                          }
                )
            );
        });

        socket.on("connect_error", (error) => {
            console.error("Socket error:", error);
        });

        return () => {
            socket.disconnect();
            socketRef.current = null;
        };
    }, [user]);

    async function handleLogin(event) {
        event.preventDefault();

        const cleanNickname = nickname.trim();

        if (!cleanNickname) {
            setLoginError("Введите ник!");
            return;
        }

        setLoginError("");
        setLoginLoading(true);

        try {
            const response = await fetch(
                "http://localhost:3000/api/login",
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        nickname: cleanNickname
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || "Не удалось войти в чат"
                );
            }

            localStorage.setItem(
                "chatUser",
                JSON.stringify(data.user)
            );
            setUser(data.user);
            setNickname("");
        } catch (error) {
            setLoginError(error.message);
        } finally {
            setLoginLoading(false);
        }
    }

    function handleLogout() {
        socketRef.current?.disconnect();
        localStorage.removeItem("chatUser");
        setUser(null);
        setMessages([]);
    }

    function handleSendMessage(event) {
        event.preventDefault();

        const text = messageText.trim();

        if (!text || !socketRef.current) return;

        socketRef.current.emit("send_message", text);
        setMessageText("");
    }

    function handleReaction(messageId, emoji) {
        if (!socketRef.current) return;

        socketRef.current.emit("add_reaction", {
            messageId,
            emoji
        });

        setOpenReactionMenu(null);
    }

    function getReactionGroups(reactions = []) {
        const groups = {};

        reactions.forEach((reaction) => {
            groups[reaction.emoji] =
                (groups[reaction.emoji] || 0) + 1;
        });

        return Object.entries(groups);
    }

    if (!user) {
        return (
            <div className="auth-page">
                <div className="auth-background-glow auth-glow-one" />
                <div className="auth-background-glow auth-glow-two" />

                <main className="auth-card">
                    <div className="auth-logo">
                        <span className="auth-logo-mark">✦</span>
                    </div>

                    <div className="auth-heading">
                        <p className="auth-eyebrow">MULTIUSER CHAT</p>
                        <h1>Добро пожаловать</h1>
                        <p className="auth-subtitle">
                            Общайтесь в реальном времени
                            с другими участниками.
                        </p>
                    </div>

                    <form className="auth-form" onSubmit={handleLogin}>
                        <div className="auth-field">
                            <label htmlFor="nickname">
                                Ваш никнейм
                            </label>

                            <div
                                className={`auth-input-row ${
                                    loginError ? "has-error" : ""
                                }`}
                            >
                                <div className="nickname-input-wrap">
                                    <span className="input-icon">@</span>

                                    <input
                                        id="nickname"
                                        type="text"
                                        value={nickname}
                                        onChange={(event) => {
                                            setNickname(
                                                event.target.value
                                            );
                                            if (loginError) {
                                                setLoginError("");
                                            }
                                        }}
                                        placeholder="Например, Alex"
                                        maxLength={50}
                                        autoComplete="off"
                                        autoFocus
                                    />
                                </div>

                                {loginError && (
                                    <div className="login-error">
                                        <span className="error-mark">!</span>
                                        <span>{loginError}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <button
                            className="auth-submit"
                            type="submit"
                            disabled={loginLoading}
                        >
                            {loginLoading ? (
                                <>
                                    <span className="button-spinner" />
                                    Вход...
                                </>
                            ) : (
                                <>
                                    Войти в чат
                                    <span className="button-arrow">→</span>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="auth-footer">
                        <span className="footer-dot" />
                        <span>
                            Введите никнейм и начните общение
                        </span>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="chat-page">
            <header className="chat-header">
                <div className="chat-header-inner">
                    <div className="chat-brand">
                        <div className="chat-brand-icon">✦</div>

                        <div>
                            <h1>Многопользовательский чат</h1>
                            <p>Общение в реальном времени</p>
                        </div>
                    </div>

                    <div className="chat-user-area">
                        <div className="chat-user-info">
                            <div className="user-avatar">
                                {user.nickname.charAt(0).toUpperCase()}
                            </div>

                            <div>
                                <span className="user-label">
                                    Вы вошли как
                                </span>
                                <strong>{user.nickname}</strong>
                            </div>
                        </div>

                        <button
                            className="logout-button"
                            onClick={handleLogout}
                            title="Выйти"
                        >
                            <span>Выйти</span>
                            <span className="logout-icon">↪</span>
                        </button>
                    </div>
                </div>
            </header>

            <main className="chat-content">
                <section className="chat-window">
                    <div className="chat-window-header">
                        <div>
                            <h2>Общий чат</h2>
                            <p>Все сообщения видны участникам</p>
                        </div>

                        <div className="online-indicator">
                            <span />
                            Онлайн
                        </div>
                    </div>

                    <div
                        className="messages-container"
                        onClick={() => setOpenReactionMenu(null)}
                    >
                        {messages.length === 0 ? (
                            <div className="empty-chat">
                                <div className="empty-chat-icon">💬</div>
                                <h3>Здесь пока тихо</h3>
                                <p>
                                    Отправьте первое сообщение,
                                    чтобы начать разговор.
                                </p>
                            </div>
                        ) : (
                            <div className="messages-list">
                                {messages.map((message, index) => {
                                    const isBot =
                                        message.nickname === "Бот";

                                    if (
                                        message.type === "system" &&
                                        !isBot
                                    ) {
                                        return (
                                            <div
                                                className="system-message"
                                                key={
                                                    message.id ??
                                                    `system-${index}`
                                                }
                                            >
                                                <span className="system-line" />
                                                <span className="system-icon">
                                                    ✦
                                                </span>
                                                <span className="system-text">
                                                    {message.text}
                                                </span>
                                                <span className="system-line" />
                                            </div>
                                        );
                                    }

                                    const isOwn =
                                        !isBot &&
                                        message.nickname ===
                                            user.nickname;

                                    const reactionGroups =
                                        getReactionGroups(
                                            message.reactions
                                        );

                                    return (
                                        <div
                                            className={`message-row ${
                                                isOwn
                                                    ? "own"
                                                    : isBot
                                                        ? "bot"
                                                        : "other"
                                            }`}
                                            key={
                                                message.id ??
                                                `message-${index}`
                                            }
                                        >
                                            {!isOwn && (
                                                <div className="message-avatar">
                                                    {isBot
                                                        ? "✦"
                                                        : message.nickname
                                                              .charAt(0)
                                                              .toUpperCase()}
                                                </div>
                                            )}

                                            <div className="message-column">
                                                <div
                                                    className={`message-meta ${
                                                        isOwn
                                                            ? "own-meta"
                                                            : ""
                                                    }`}
                                                >
                                                    <span className="message-author">
                                                        {isOwn
                                                            ? "Вы"
                                                            : message.nickname}
                                                    </span>
                                                </div>

                                                <div className="message-with-reaction">
                                                    <div
                                                        className={`message-bubble ${
                                                            isOwn
                                                                ? "own-bubble"
                                                                : "other-bubble"
                                                        }`}
                                                    >
                                                        <div className="message-text">
                                                            {message.text}
                                                        </div>

                                                        <button
                                                            className="reaction-trigger"
                                                            type="button"
                                                            onClick={(event) => {
                                                                event.stopPropagation();

                                                                setOpenReactionMenu(
                                                                    openReactionMenu ===
                                                                        message.id
                                                                        ? null
                                                                        : message.id
                                                                );
                                                            }}
                                                            title="Добавить реакцию"
                                                        >
                                                            +
                                                        </button>
                                                    </div>

                                                    {openReactionMenu ===
                                                        message.id && (
                                                        <div
                                                            className={`reaction-menu ${
                                                                isOwn
                                                                    ? "reaction-menu-own"
                                                                    : ""
                                                            }`}
                                                            onClick={(event) =>
                                                                event.stopPropagation()
                                                            }
                                                        >
                                                            {REACTIONS.map(
                                                                (emoji) => (
                                                                    <button
                                                                        key={
                                                                            emoji
                                                                        }
                                                                        type="button"
                                                                        onClick={() =>
                                                                            handleReaction(
                                                                                message.id,
                                                                                emoji
                                                                            )
                                                                        }
                                                                    >
                                                                        {emoji}
                                                                    </button>
                                                                )
                                                            )}
                                                        </div>
                                                    )}
                                                </div>

                                                {reactionGroups.length > 0 && (
                                                    <div
                                                        className={`reaction-list ${
                                                            isOwn
                                                                ? "reaction-list-own"
                                                                : ""
                                                        }`}
                                                    >
                                                        {reactionGroups.map(
                                                            ([
                                                                emoji,
                                                                count
                                                            ]) => (
                                                                <button
                                                                    className="reaction-badge"
                                                                    key={emoji}
                                                                    type="button"
                                                                    onClick={() =>
                                                                        handleReaction(
                                                                            message.id,
                                                                            emoji
                                                                        )
                                                                    }
                                                                >
                                                                    <span>
                                                                        {emoji}
                                                                    </span>
                                                                    <span>
                                                                        {count}
                                                                    </span>
                                                                </button>
                                                            )
                                                        )}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}

                                <div ref={messagesEndRef} />
                            </div>
                        )}
                    </div>

                    <form
                        className="message-form"
                        onSubmit={handleSendMessage}
                    >
                        <input
                            type="text"
                            value={messageText}
                            onChange={(event) =>
                                setMessageText(event.target.value)
                            }
                            placeholder="Напишите сообщение..."
                            autoComplete="off"
                        />

                        <button
                            type="submit"
                            disabled={!messageText.trim()}
                            title="Отправить сообщение"
                        >
                            <span>Отправить</span>
                            <span className="send-icon">↑</span>
                        </button>
                    </form>
                </section>
            </main>
        </div>
    );
}

function App() {
    if (window.location.pathname === "/admin") {
        return <Admin />;
    }

    return <AppContent />;
}

export default App;
