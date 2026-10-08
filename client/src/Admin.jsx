import { useEffect, useState } from "react";

const API_URL = "http://localhost:3000";

function Admin() {
    const [token, setToken] = useState(
        () => localStorage.getItem("adminToken") || ""
    );

    const [password, setPassword] = useState("");
    const [commands, setCommands] = useState([]);

    const [loginError, setLoginError] = useState("");
    const [pageError, setPageError] = useState("");

    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    const [newCommand, setNewCommand] = useState("");
    const [newPrompt, setNewPrompt] = useState("");

    // ЗАГРУЗКА КОМАНД
    

    async function loadCommands(currentToken = token) {
        if (!currentToken) {
            return;
        }

        try {
            setPageError("");

            const response = await fetch(
                `${API_URL}/api/admin/commands`,
                {
                    headers: {
                        Authorization: `Bearer ${currentToken}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                if (response.status === 401) {
                    localStorage.removeItem(
                        "adminToken"
                    );
                    setToken("");
                }

                throw new Error(
                    data.error ||
                        "Не удалось получить команды"
                );
            }

            setCommands(data);
        } catch (error) {
            setPageError(error.message);
        }
    }

    useEffect(() => {
        if (token) {
            loadCommands(token);
        }
    }, [token]);

    
    // ВХОД
   

    async function handleLogin(event) {
        event.preventDefault();

        if (!password.trim()) {
            setLoginError("Введите пароль!");
            return;
        }

        setLoginError("");
        setLoading(true);

        try {
            const response = await fetch(
                `${API_URL}/api/admin/login`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        password
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error || "Неверный пароль"
                );
            }

            localStorage.setItem(
                "adminToken",
                data.token
            );

            setToken(data.token);
            setPassword("");
        } catch (error) {
            setLoginError(error.message);
        } finally {
            setLoading(false);
        }
    }

   
    // ОБНОВЛЕНИЕ КОМАНДЫ
   

    function updateCommand(id, field, value) {
        setCommands((prev) =>
            prev.map((command) =>
                command.id === id
                    ? {
                          ...command,
                          [field]: value
                      }
                    : command
            )
        );
    }

    
    // СОХРАНЕНИЕ
    
    async function handleSaveCommand(command) {
        if (
            !command.command.trim() ||
            !command.prompt.trim()
        ) {
            setPageError(
                "Команда и prompt не должны быть пустыми."
            );
            return;
        }

        setSaving(true);
        setPageError("");

        try {
            const response = await fetch(
                `${API_URL}/api/admin/commands/${command.id}`,
                {
                    method: "PUT",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        command: command.command,
                        prompt: command.prompt
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                        "Не удалось сохранить команду"
                );
            }

            setCommands((prev) =>
                prev.map((item) =>
                    item.id === command.id
                        ? data
                        : item
                )
            );
        } catch (error) {
            setPageError(error.message);
        } finally {
            setSaving(false);
        }
    }

    
    // УДАЛЕНИЕ


    async function handleDeleteCommand(id) {
        const confirmed = window.confirm(
            "Удалить эту команду?"
        );

        if (!confirmed) {
            return;
        }

        setPageError("");

        try {
            const response = await fetch(
                `${API_URL}/api/admin/commands/${id}`,
                {
                    method: "DELETE",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                        "Не удалось удалить команду"
                );
            }

            setCommands((prev) =>
                prev.filter(
                    (command) => command.id !== id
                )
            );
        } catch (error) {
            setPageError(error.message);
        }
    }

    
    // ДОБАВЛЕНИЕ
    

    async function handleAddCommand(event) {
        event.preventDefault();

        if (
            !newCommand.trim() ||
            !newPrompt.trim()
        ) {
            setPageError(
                "Заполните название команды и prompt."
            );
            return;
        }

        setSaving(true);
        setPageError("");

        try {
            const response = await fetch(
                `${API_URL}/api/admin/commands`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json",
                        Authorization: `Bearer ${token}`
                    },
                    body: JSON.stringify({
                        command: newCommand,
                        prompt: newPrompt
                    })
                }
            );

            const data = await response.json();

            if (!response.ok) {
                throw new Error(
                    data.error ||
                        "Не удалось добавить команду"
                );
            }

            setCommands((prev) => [
                ...prev,
                data
            ]);

            setNewCommand("");
            setNewPrompt("");
        } catch (error) {
            setPageError(error.message);
        } finally {
            setSaving(false);
        }
    }

    
    // ВЫХОД
    

    function handleLogout() {
        localStorage.removeItem("adminToken");
        setToken("");
        setCommands([]);
    }

    
    // LOGIN
  

    if (!token) {
        return (
            <div className="admin-login-page">
                <div className="admin-background-glow admin-glow-one" />
                <div className="admin-background-glow admin-glow-two" />

                <main className="admin-login-card">
                    <a
                        href="/"
                        className="admin-back-link"
                    >
                        <span>←</span>
                        Вернуться в чат
                    </a>

                    <div className="admin-login-logo">
                        <span>⚙</span>
                    </div>

                    <div className="admin-login-heading">
                        <span className="admin-eyebrow">
                            ADMIN PANEL
                        </span>

                        <h1>
                            Панель администратора
                        </h1>

                        <p>
                            Управление командами и
                            AI-промптами чата
                        </p>
                    </div>

                    <form
                        className="admin-login-form"
                        onSubmit={handleLogin}
                    >
                        <label htmlFor="admin-password">
                            Пароль администратора
                        </label>

                        <div
                            className={`admin-password-wrap ${
                                loginError
                                    ? "has-error"
                                    : ""
                            }`}
                        >
                            <span>●</span>

                            <input
                                id="admin-password"
                                type="password"
                                value={password}
                                onChange={(event) => {
                                    setPassword(
                                        event.target.value
                                    );

                                    if (loginError) {
                                        setLoginError("");
                                    }
                                }}
                                placeholder="Введите пароль"
                                autoFocus
                            />
                        </div>

                        {loginError && (
                            <div className="admin-error">
                                <span>!</span>
                                {loginError}
                            </div>
                        )}

                        <button
                            className="admin-login-button"
                            type="submit"
                            disabled={loading}
                        >
                            {loading ? (
                                <>
                                    <span className="button-spinner" />
                                    Проверка...
                                </>
                            ) : (
                                <>
                                    Войти в панель
                                    <span>→</span>
                                </>
                            )}
                        </button>
                    </form>

                    <div className="admin-login-footer">
                        Доступ только для администратора
                    </div>
                </main>
            </div>
        );
    }

    
    // ADMIN PANEL
    
    return (
        <div className="admin-page">
            <header className="admin-header">
                <div className="admin-header-inner">
                    <div className="admin-brand">
                        <div className="admin-brand-icon">
                            ⚙
                        </div>

                        <div>
                            <span>
                                ADMINISTRATION
                            </span>
                            <h1>
                                Панель управления
                            </h1>
                        </div>
                    </div>

                    <div className="admin-header-actions">
                        <a
                            href="/"
                            className="admin-chat-link"
                        >
                            <span>←</span>
                            Открыть чат
                        </a>

                        <button
                            className="admin-logout-button"
                            onClick={handleLogout}
                        >
                            Выйти
                        </button>
                    </div>
                </div>
            </header>

            <main className="admin-content">
                <div className="admin-page-heading">
                    <div>
                        <span className="section-eyebrow">
                            CONFIGURATION
                        </span>

                        <h2>
                            AI-команды
                        </h2>

                        <p>
                            Здесь можно редактировать
                            команды, которые пользователи
                            вызывают через <code>!</code>.
                        </p>
                    </div>

                    <div className="command-counter">
                        <strong>
                            {commands.length}
                        </strong>
                        <span>
                            {commands.length === 1
                                ? "команда"
                                : commands.length < 5
                                ? "команды"
                                : "команд"}
                        </span>
                    </div>
                </div>

                {pageError && (
                    <div className="admin-page-error">
                        <span>!</span>
                        {pageError}
                    </div>
                )}

                <section className="commands-section">
                    <div className="section-title-row">
                        <div>
                            <h3>
                                Существующие команды
                            </h3>

                            <p>
                                Изменения применяются сразу
                                после сохранения.
                            </p>
                        </div>
                    </div>

                    <div className="commands-grid">
                        {commands.map(
                            (command, index) => (
                                <article
                                    className="command-card"
                                    key={command.id}
                                >
                                    <div className="command-card-top">
                                        <div className="command-index">
                                            {String(
                                                index + 1
                                            ).padStart(
                                                2,
                                                "0"
                                            )}
                                        </div>

                                        <div className="command-title">
                                            <span>
                                                Команда
                                            </span>

                                            <div className="command-name">
                                                !
                                                {command.command}
                                            </div>
                                        </div>

                                        <button
                                            className="delete-button"
                                            type="button"
                                            onClick={() =>
                                                handleDeleteCommand(
                                                    command.id
                                                )
                                            }
                                            title="Удалить"
                                        >
                                            ×
                                        </button>
                                    </div>

                                    <div className="command-fields">
                                        <div className="admin-field">
                                            <label>
                                                Название команды
                                            </label>

                                            <div className="command-input-wrap">
                                                <span>!</span>

                                                <input
                                                    type="text"
                                                    value={
                                                        command.command
                                                    }
                                                    onChange={(
                                                        event
                                                    ) =>
                                                        updateCommand(
                                                            command.id,
                                                            "command",
                                                            event
                                                                .target
                                                                .value
                                                        )
                                                    }
                                                />
                                            </div>
                                        </div>

                                        <div className="admin-field">
                                            <div className="label-with-hint">
                                                <label>
                                                    AI Prompt
                                                </label>

                                                <span>
                                                    {"{text}"} =
                                                    сообщение
                                                </span>
                                            </div>

                                            <textarea
                                                value={
                                                    command.prompt
                                                }
                                                onChange={(
                                                    event
                                                ) =>
                                                    updateCommand(
                                                        command.id,
                                                        "prompt",
                                                        event
                                                            .target
                                                            .value
                                                    )
                                                }
                                                rows={5}
                                            />
                                        </div>

                                        <button
                                            className="save-command-button"
                                            type="button"
                                            onClick={() =>
                                                handleSaveCommand(
                                                    command
                                                )
                                            }
                                            disabled={saving}
                                        >
                                            <span>
                                                Сохранить изменения
                                            </span>
                                            <span>
                                                ✓
                                            </span>
                                        </button>
                                    </div>
                                </article>
                            )
                        )}
                    </div>
                </section>

                <section className="add-command-section">
                    <div className="add-command-icon">
                        +
                    </div>

                    <div className="add-command-info">
                        <span className="section-eyebrow">
                            NEW COMMAND
                        </span>

                        <h3>
                            Добавить новую команду
                        </h3>

                        <p>
                            Создайте новую команду и задайте
                            инструкцию для AI.
                        </p>
                    </div>

                    <form
                        className="add-command-form"
                        onSubmit={handleAddCommand}
                    >
                        <div className="admin-field">
                            <label>
                                Команда
                            </label>

                            <div className="command-input-wrap">
                                <span>!</span>

                                <input
                                    type="text"
                                    value={newCommand}
                                    onChange={(event) =>
                                        setNewCommand(
                                            event.target
                                                .value
                                        )
                                    }
                                    placeholder="например, кратко"
                                />
                            </div>
                        </div>

                        <div className="admin-field add-prompt-field">
                            <label>
                                Prompt
                            </label>

                            <textarea
                                value={newPrompt}
                                onChange={(event) =>
                                    setNewPrompt(
                                        event.target.value
                                    )
                                }
                                placeholder="Например: Кратко объясни следующий текст: {text}"
                                rows={4}
                            />
                        </div>

                        <button
                            className="add-command-button"
                            type="submit"
                            disabled={saving}
                        >
                            <span>Добавить команду</span>
                            <span>+</span>
                        </button>
                    </form>
                </section>
            </main>

            <footer className="admin-footer">
                <span>
                    Multiuser Chat
                </span>

                <span>
                    Панель администратора
                </span>
            </footer>
        </div>
    );
}

export default Admin;