<?php
session_start();

$USERNAME = 'admin';
$PASSWORD_HASH = '$2y$12$H7fEC2mQA8F6Eess.g0Mh.D.5v4MbsjiLnrhOV/MQ9VrL/KNX9FyK';

if (!empty($_SESSION['logged_in'])) {
    header('Location: index.php');
    exit;
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $user = $_POST['username'] ?? '';
    $pass = $_POST['password'] ?? '';

    if ($user === $USERNAME && password_verify($pass, $PASSWORD_HASH)) {
        session_regenerate_id(true);
        $_SESSION['logged_in'] = true;
        header('Location: index.php');
        exit;
    } else {
        $error = 'Usuario o contraseña incorrectos';
    }
}
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Iniciar Sesión — Dashboard Financiero</title>
    <link rel="stylesheet" href="css/style.css">
    <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap">
    <link rel="stylesheet" href="https://fonts.googleapis.com/icon?family=Material+Icons+Round">
</head>
<body>
    <div class="login-container">
        <div class="login-card">
            <div class="login-logo">
                <span class="material-icons-round">assessment</span>
            </div>
            <h1 class="login-title">Dashboard Financiero</h1>
            <p class="login-subtitle">Inicia sesión para continuar</p>

            <?php if ($error): ?>
                <div class="login-error">
                    <span class="material-icons-round">error_outline</span>
                    <?= htmlspecialchars($error) ?>
                </div>
            <?php endif; ?>

            <form method="POST" class="login-form" autocomplete="off">
                <div class="login-field">
                    <span class="material-icons-round">person</span>
                    <input type="text" name="username" placeholder="Usuario" required autofocus>
                </div>
                <div class="login-field">
                    <span class="material-icons-round">lock</span>
                    <input type="password" name="password" placeholder="Contraseña" required>
                </div>
                <button type="submit" class="btn btn-primary login-btn">
                    <span class="material-icons-round">login</span>
                    Ingresar
                </button>
            </form>
        </div>
    </div>
</body>
</html>
