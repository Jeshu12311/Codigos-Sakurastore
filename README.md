# Códigos SakuraStore

Portal web para administrar ventas y entregar códigos temporales de acceso de forma controlada. Incluye un portal público de consulta, panel administrativo, API Express, persistencia PostgreSQL con Prisma y limpieza automática de códigos expirados.

> Usa este sistema únicamente con cuentas y servicios propios o expresamente autorizados. La aplicación no obtiene credenciales, no evade 2FA y no automatiza accesos a servicios de terceros.

## Funcionalidades

- Consulta pública mediante la combinación exacta `cuenta + código de venta`.
- Espera automática de un código cada 5 segundos, durante un máximo de 2 minutos.
- Cuenta regresiva y copia del código al portapapeles.
- Administración de cuentas, ventas y códigos temporales.
- Invalidación y marcado manual de códigos como usados.
- Dashboard, búsquedas e historial de auditoría.
- Autenticación administrativa con JWT en cookie `HttpOnly` y protección CSRF.
- Validación estricta, Helmet, límites de solicitudes y bloqueo temporal de intentos.
- Limpieza diaria de códigos antiguos según `CODE_RETENTION_DAYS`.
- Arquitectura de proveedores preparada para integraciones autorizadas; la implementación inicial es manual.

## Tecnologías y estructura

- Frontend: React, TypeScript, Vite y Tailwind CSS.
- Backend: Node.js 20, TypeScript y Express.
- Datos: PostgreSQL 16 y Prisma ORM.
- Pruebas: Vitest y Supertest.

```text
.
├── backend/              API, Prisma, migraciones, seed y tests
├── frontend/             aplicación React
├── docker/               configuración de Nginx
├── Dockerfile            build multi-stage de frontend y backend
├── docker-compose.yml    PostgreSQL, API y aplicación web
└── .env.example          referencia de variables
```

## Requisitos

Para desarrollo local:

- Node.js 20 o posterior.
- npm 10 o posterior.
- PostgreSQL 16 recomendado.

Para ejecución en contenedores solo se necesita Docker Engine con Docker Compose v2.

## Variables de entorno

| Variable | Descripción | Ejemplo de desarrollo |
| --- | --- | --- |
| `DATABASE_URL` | URL de conexión usada por Prisma en desarrollo local | `postgresql://otp_user:otp_password@localhost:5432/otp_portal?schema=public` |
| `POSTGRES_DB` | Base creada por el contenedor de PostgreSQL | `otp_portal` |
| `POSTGRES_USER` | Usuario del contenedor de PostgreSQL | `otp_user` |
| `POSTGRES_PASSWORD` | Contraseña del contenedor de PostgreSQL | definir una contraseña propia |
| `NODE_ENV` | Entorno: `development`, `test` o `production` | `development` |
| `PORT` | Puerto de la API | `4000` |
| `FRONTEND_URL` | Origen permitido por CORS, sin barra final | `http://localhost:5173` |
| `JWT_SECRET` | Secreto de firma, mínimo 32 caracteres | generar un valor aleatorio |
| `JWT_EXPIRES_IN` | Duración del token administrativo | `8h` |
| `COOKIE_SECURE` | Envía cookies solo por HTTPS | `false` solo en HTTP local |
| `TRUST_PROXY` | Confía en el proxy para IP y protocolo | `false` localmente |
| `CODE_RETENTION_DAYS` | Días que se conservan códigos expirados antes de borrarlos | `30` |
| `ADMIN_EMAIL` | Correo del administrador creado/actualizado por el seed | `admin@example.com` |
| `ADMIN_PASSWORD` | Contraseña del administrador; mínimo 12 caracteres | definir una contraseña propia |
| `APP_PORT` | Puerto público de la aplicación en Docker | `8080` |
| `VITE_API_URL` | Base de la API incorporada al build del frontend | `http://localhost:4000/api` |

No confirmes archivos `.env` ni uses los valores de ejemplo en producción. Para generar secretos en PowerShell puedes usar:

```powershell
[Convert]::ToBase64String([Security.Cryptography.RandomNumberGenerator]::GetBytes(48))
```

## Desarrollo local

1. Crea la base de datos y el usuario de PostgreSQL indicados en `DATABASE_URL`.
2. Instala dependencias desde la raíz:

   ```powershell
   npm install
   ```

3. Copia y ajusta las variables del backend. Los comandos del workspace se ejecutan desde `backend`, por lo que su archivo debe estar allí:

   ```powershell
   Copy-Item .env.example backend/.env
   Copy-Item frontend/.env.example frontend/.env
   ```

4. Genera Prisma, aplica las migraciones y crea el administrador:

   ```powershell
   npm run db:generate
   npm run db:migrate
   npm run db:seed
   ```

5. Inicia API y frontend con recarga automática:

   ```powershell
   npm run dev
   ```

En macOS o Linux sustituye `Copy-Item origen destino` por `cp origen destino`.

### URLs de desarrollo

- Portal público: [http://localhost:5173/codigos](http://localhost:5173/codigos)
- Inicio de sesión: [http://localhost:5173/admin/login](http://localhost:5173/admin/login)
- Dashboard: [http://localhost:5173/admin/dashboard](http://localhost:5173/admin/dashboard)
- API: [http://localhost:4000/api](http://localhost:4000/api)

Las demás vistas administrativas están en `/admin/accounts`, `/admin/sales`, `/admin/codes` y `/admin/logs`.

## Ejecución con Docker Compose

1. Crea el archivo de entorno que Compose lee desde la raíz:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Cambia como mínimo `POSTGRES_PASSWORD`, `JWT_SECRET`, `ADMIN_EMAIL` y `ADMIN_PASSWORD`. Para el despliegue local incluido, cambia además `FRONTEND_URL` a `http://localhost:8080` y `TRUST_PROXY` a `true`.
3. Construye e inicia PostgreSQL, API y frontend:

   ```powershell
   docker compose up -d --build
   ```

4. Crea o actualiza el administrador inicial:

   ```powershell
   docker compose exec backend npm run prisma:seed -w backend
   ```

La migración de producción (`prisma migrate deploy`) se ejecuta automáticamente antes de iniciar la API. La aplicación queda disponible en:

- Portal público: [http://localhost:8080/codigos](http://localhost:8080/codigos)
- Administrador: [http://localhost:8080/admin/login](http://localhost:8080/admin/login)

Comandos operativos frecuentes:

```powershell
docker compose ps
docker compose logs -f backend
docker compose restart backend
docker compose down
```

`docker compose down` conserva el volumen `postgres_data`. El comando `docker compose down -v` borra también la base de datos y debe usarse únicamente cuando se quiera eliminar esos datos de forma deliberada.

## Migraciones y seed

Crear una migración durante el desarrollo:

```powershell
Set-Location backend
npx prisma migrate dev --name descripcion_del_cambio
Set-Location ..
```

Aplicar migraciones existentes sin crear otras (producción):

```powershell
npm run prisma:deploy -w backend
```

Volver a ejecutar el seed es seguro: hace `upsert` por correo y actualiza el hash de la contraseña configurada.

```powershell
npm run db:seed
```

Las credenciales de desarrollo son exactamente los valores configurados en `ADMIN_EMAIL` y `ADMIN_PASSWORD`; el repositorio no incluye una contraseña predeterminada. El seed rechaza contraseñas de menos de 12 caracteres.

## Calidad y pruebas

```powershell
# Suite de backend
npm test

# Verificación de tipos en ambos workspaces
npm run typecheck

# Build completo
npm run build
```

Las pruebas cubren autenticación, creación de ventas y códigos, consultas válidas e inválidas, expiración y límites de intentos.

## Producción

Antes de exponer el servicio:

1. Usa contraseñas únicas y un `JWT_SECRET` aleatorio de alta entropía.
2. Termina TLS en un proxy o balanceador, establece `COOKIE_SECURE=true` y `TRUST_PROXY=true`.
3. Define `FRONTEND_URL` con el origen HTTPS público exacto.
4. Publica únicamente el servicio `app`; `backend` y `db` deben permanecer en la red privada.
5. Restringe el acceso a PostgreSQL y configura copias de seguridad periódicas del volumen.
6. Conserva y revisa los logs de auditoría, pero evita registrar códigos o secretos fuera de los flujos previstos.
7. Ejecuta `npm test`, `npm run typecheck` y `npm run build` antes del despliegue.

El objetivo `backend-runtime` del Dockerfile ejecuta las migraciones pendientes al arrancar. El objetivo `frontend-runtime` sirve los archivos estáticos con Nginx y redirige `/api` al backend, de modo que las cookies y CSRF funcionan en un único origen.

## Seguridad y operación

- Las contraseñas administrativas se almacenan mediante bcrypt; nunca en texto plano.
- El JWT se guarda en una cookie `HttpOnly`, `SameSite=Strict`; las escrituras administrativas requieren un token CSRF adicional.
- Prisma parametriza las consultas y reduce el riesgo de inyección SQL.
- El portal público siempre exige cuenta y código de venta, responde con mensajes genéricos y limita intentos por IP/código.
- Los códigos usados, invalidados o expirados dejan de entregarse.
- La tarea de limpieza corre diariamente a las 03:17 del huso horario del contenedor y elimina códigos cuyo vencimiento supera el período de retención.
- `EmailCodeProvider` es únicamente una base para una futura integración oficial con OAuth y permisos explícitos. No implementa scraping ni acceso a buzones de terceros.

Para respaldar PostgreSQL en Docker:

```powershell
docker compose exec -T db pg_dump -U $env:POSTGRES_USER -d $env:POSTGRES_DB -Fc > otp_portal.dump
```

Restaura primero en un entorno aislado y verificado; una restauración sobrescribe o combina datos según las opciones de `pg_restore` elegidas.
