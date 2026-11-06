// Documentación interactiva (Swagger UI) de la API.
//
//   GET /api-docs                Página de Swagger UI (se puede probar cada endpoint desde ahí)
//   GET /api-docs/openapi.json   El contrato OpenAPI (docs/openapi.json)
//
// No requiere instalar paquetes: la página carga Swagger UI desde un CDN, por lo que el navegador
// necesita conexión a internet. Este archivo vive fuera de src/routes a propósito: las pruebas de
// contrato solo comparan las rutas de la API con docs/openapi.json, no las de la documentación.

const fs = require('fs');
const path = require('path');
const express = require('express');

const router = express.Router();

const RUTA_CONTRATO = path.join(__dirname, '..', '..', 'docs', 'openapi.json');
const VERSION_SWAGGER_UI = '5.17.14';
const CDN = `https://cdn.jsdelivr.net/npm/swagger-ui-dist@${VERSION_SWAGGER_UI}`;

const PAGINA = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>FinanControl API - Documentación</title>
  <link rel="stylesheet" href="${CDN}/swagger-ui.css">
  <style>
    body { margin: 0; background: #fafafa; }
    #aviso { display: none; max-width: 640px; margin: 48px auto; padding: 0 16px; font: 16px/1.5 system-ui, sans-serif; }
    #aviso a { color: #0b6b5c; }
  </style>
</head>
<body>
  <div id="swagger-ui"></div>
  <div id="aviso">
    <h1>No se pudo cargar Swagger UI</h1>
    <p>La documentación se muestra con Swagger UI desde un CDN y necesita conexión a internet.
       Mientras tanto puedes leer el contrato en
       <a href="/api-docs/openapi.json">/api-docs/openapi.json</a>.</p>
  </div>
  <script src="${CDN}/swagger-ui-bundle.js"
          onerror="document.getElementById('aviso').style.display='block'"></script>
  <script>
    window.addEventListener('load', function () {
      if (!window.SwaggerUIBundle) { document.getElementById('aviso').style.display = 'block'; return; }
      window.ui = SwaggerUIBundle({
        url: '/api-docs/openapi.json',
        dom_id: '#swagger-ui',
        deepLinking: true,
        persistAuthorization: true,
        tryItOutEnabled: true,
        docExpansion: 'list',
        defaultModelsExpandDepth: 0
      });
    });
  </script>
</body>
</html>
`;

router.get('/api-docs', (req, res) => {
    res.set('Cache-Control', 'no-cache');
    res.type('html').send(PAGINA);
});

// El contrato se entrega con "servers" apuntando a la dirección desde la que se está consultando,
// así el botón "Try it out" siempre llama al mismo origen (sin problemas de CORS).
router.get('/api-docs/openapi.json', (req, res) => {
    try {
        const contrato = JSON.parse(fs.readFileSync(RUTA_CONTRATO, 'utf8'));

        contrato.servers = [{ url: `${req.protocol}://${req.get('host')}`, description: 'Este servidor' }];

        res.set('Cache-Control', 'no-cache');
        res.json(contrato);
    } catch (error) {
        console.error(error);

        res.status(500).json({ mensaje: 'No se pudo leer el contrato OpenAPI' });
    }
});

module.exports = router;
