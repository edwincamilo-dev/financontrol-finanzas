require('dotenv').config();

const { validarJwtSecret } = require('./config/seguridad');

// Sin un JWT_SECRET largo cualquiera podría falsificar tokens: el servidor no arranca.
const problemaSecreto = validarJwtSecret(process.env.JWT_SECRET);

if (problemaSecreto) {
    console.error(problemaSecreto);
    process.exit(1);
}

const app = require('./server');

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor funcionando en http://localhost:${PORT}`);
});
