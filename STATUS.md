# Cauce — estado y plan

Un framework de aplicación en TypeScript, extensible, con la ambición de resolver de a poco lo que resuelven Spring Boot, Laravel, .NET Core y un framework de referencia en Kotlin (Trantor): inyección de dependencias, configuración, hosting/ciclo de vida, módulos, ruteo web, y más adelante eventos, jobs y scheduling.

El norte no es clonar todo —es demasiado— sino construir un núcleo chico que un tercero pueda extender sin tocarlo, con contratos tipados y sin un solo `any`.

El nombre: el cauce es el lecho por donde corre el agua; acá, el pipeline por donde fluye cada request.

---

## Cómo se trabaja

- **Slices chicos y progresivos.** Cada uno entra en pocas sesiones, cierra verde y se puede publicar/versionar.
- **El código lo escribo yo** (con ayuda puntual), no lo genera un agente de una. Cada slice arranca por investigar cómo lo resuelven otros frameworks —leyendo su código fuente— y recién ahí se implementa.
- **TypeScript estricto, sin `any`.** Los tipos se propagan por el pipeline y por las extensiones.
- **TDD con dobles de test escritos a mano**, no mocks de librería.
- **Compuerta de cada slice:** `tsc` limpio + tests verdes + la pieza usada desde AFUERA del núcleo cuando corresponde.
- **Identidad de paquete:** scope `@caucejs` (org npm `caucejs`; `@cauce` estaba tomado). Primer paquete `@caucejs/core`; más adelante `@caucejs/web`, `@caucejs/di`, etc. Repo: [ldamoredev/caucejs](https://github.com/ldamoredev/caucejs).

---

## Forma del repo

Monorepo con **pnpm workspaces** y **Turborepo**. Varios paquetes, un grafo de tareas (`build` / `typecheck` / `test`) que respeta dependencias entre ellos.

| Ruta | Paquete | Rol |
| --- | --- | --- |
| `packages/core` | `@caucejs/core` | Núcleo público. Hoy es un walking skeleton (stub + `tsc` + Vitest). Acá se escribe el framework. |
| `packages/typescript-config` | `@caucejs/typescript-config` | Config TS compartida. Privado, no se publica. |

Más adelante entran como hermanos en `packages/`: `@caucejs/web`, `@caucejs/di`, y lo que haga falta. Si aparece una app de ejemplo o un playground, va en `apps/`.

### Decisiones de arranque (revisables en el Slice 1)

- **pnpm**, no npm/yarn: workspaces nativos, `workspace:*`, catalog de versiones.
- **Turborepo**, no Nx: orquesta el grafo con poca ceremonia. Si el repo se queda en un paquete por mucho tiempo, Turbo no molesta; cuando aparezcan `@caucejs/web` y el resto, ya está.
- **ESM only** (`"type": "module"`, `exports` con `import` + `types`). Dual ESM/CJS no entra: Node ≥ 22.
- **`tsc` para emitir** `@caucejs/core` (JS + `.d.ts` + source maps). Sin tsup.
- **Vitest** para tests, dobles a mano.
- **Node >= 22.12.** Changesets + GitHub Actions + OIDC (sin `NPM_TOKEN`).

El stub de `@caucejs/core` (`createCauce`) no es el framework. Está para que compile, testee y se pueda reemplazar slice a slice.

---

## Los 10 primeros slices

Por qué este orden: se arranca por el núcleo de composición —lo más chico que ya es un framework y ya se publica—, después la columna vertebral (DI), después lo que cablea todo (config, hosting, módulos) y al final la capa web. Eventos, jobs, scheduling y cache quedan en backlog.

### 1. El paquete que se publica (walking skeleton + CI)

- [ ] **Objetivo:** un paquete mínimo (`@caucejs/core`) que compila, testea y se publica a npm por CI, versionado. El export puede ser un stub trivial; lo que importa es el pipeline de release, no las features.
- **Qué investigar/atacar:** publicación de paquetes scoped + provenance (OIDC / trusted publishing), workflow de release en GitHub Actions, build ESM (o dual ESM/CJS) con tsup vs tsc, el `exports` map y los campos de package.json (types, files), versionado con Changesets.
- **Lectura:** docs de npm "publishing scoped public packages" y "generating provenance statements"; README de Changesets; docs de tsup; una guía de "package.json exports".
- **Código fuente a leer:** el repo de Hono (su package.json: exports/types/files, y sus workflows de release); la config de Changesets de cualquier repo serio (Hono, tRPC).
- **Listo cuando:** `npm i @caucejs/core` en un proyecto limpio importa el stub; el CI corre typecheck + tests en cada PR y publica al taggear; sin `any`.

Ya hay scaffolding local (monorepo, `tsc`, Vitest, `exports`). Decisiones cerradas de este slice: ESM only, `tsc` (no tsup), Changesets + OIDC (no tag a mano, no `NPM_TOKEN`). El hueco es el pipeline. Orden fijo: el paquete tiene que existir en npm antes de poder enganchar trusted publishing.

#### Checklist Slice 1

**A. npm (cuenta que ya tenés)**

- [x] 2FA activa en la cuenta (npm ya lo exige para publicar).
- [x] Organización **`caucejs`** creada. Scope `@caucejs` (`@cauce` estaba tomado).
- [x] User `lautidamo` es owner de esa org.
- [x] `npm login` / `npm whoami` → `lautidamo`.
- [ ] *(más tarde, paso E)* En `@caucejs/core` → Access / Trusted Publisher: GitHub Actions, owner `ldamoredev`, repo `caucejs`, workflow **`release.yml`** (exacto). Environment vacío.

**B. GitHub**

- [x] Repo **público** [ldamoredev/caucejs](https://github.com/ldamoredev/caucejs).
- [ ] Actions habilitadas (Settings → Actions → Allow) — default suele alcanzar.
- [x] Sin secret `NPM_TOKEN`. El publish va por OIDC.
- [x] `owner/repo`: `ldamoredev/caucejs`.

**C. En el repo (código)**

- [x] Scope `@caucejs` y `repository` / `bugs` / `homepage` en `packages/core/package.json`.
- [x] `.changeset/config.json`: `access: "public"`, `baseBranch: "main"`, changelog GitHub, ignore `@caucejs/typescript-config`.
- [x] Scripts root `changeset` / `changeset:version` / `release`.
- [x] Primer changeset: `@caucejs/core` **minor** → `0.1.0`.
- [x] `.github/workflows/ci.yml` y `release.yml`.
- [x] Commit y push a `main`.

**D. Primer publish (local, una sola vez)**

Hace falta para *crear* el paquete en el registry. Sin ese paquete npm no te deja cargar el trusted publisher.

- [ ] `pnpm build` en el repo.
- [ ] Desde `packages/core`: `npm publish --access public` (2FA). Deja `@caucejs/core@0.0.0` en npm. No es el release anunciado; es el ancla.
- [ ] En npmjs.com, el paquete figura público bajo la org `caucejs`.

**E. Enganchar OIDC**

- [ ] Package settings de `@caucejs/core` → Trusted Publisher → GitHub Actions, `ldamoredev/caucejs` y `release.yml`.
- [ ] El job de release usa Node del `.node-version`; si el publish OIDC falla por CLI vieja, `npm install -g npm@latest` en ese job.

**F. Primer release de verdad (CI)**

- [ ] Merge a `main` con el changeset → el `release.yml` abre el PR **Version Packages** (`0.0.0` → `0.1.0` + CHANGELOG).
- [ ] Merge de ese PR → CI publica `@caucejs/core@0.1.0` por OIDC, con provenance, y crea el tag `@caucejs/core@0.1.0`.
- [ ] En la página de npm: check verde de provenance.

**G. Compuerta**

- [ ] En un directorio limpio, fuera del monorepo: `npm i @caucejs/core` e `import { createCauce } from "@caucejs/core"` resuelve JS + tipos. Sin `any`.
- [ ] Un PR de prueba deja rojo/verde el `ci.yml` (typecheck + tests + build).
- [ ] No hay `NPM_TOKEN` en el repo. No hay `require` en `exports`. `@caucejs/typescript-config` no se publicó.

### 2. El despacho tipado: Handler + Context

- [ ] **Objetivo:** el contrato atómico. Un Handler opera sobre un Context tipado y produce una salida. Despacho mínimo de un handler.
- **Qué investigar/atacar:** cómo modelar un Context agnóstico del transporte (el framework es a nivel app, no solo HTTP); cómo se propaga el tipo del Context a través del handler.
- **Lectura:** Parnas, "On the Criteria To Be Used in Decomposing Systems into Modules"; Ousterhout, "A Philosophy of Software Design", caps. 4 y 5 (módulos profundos, ocultamiento de información).
- **Código fuente a leer:** Hono `src/context.ts`; el concepto de HttpContext de .NET.
- **Listo cuando:** un handler transforma un Context tipado; un test verifica que el tipo fluye; sin `any`.

### 3. Composición de middlewares (el pipeline, modelo onion)

- [ ] **Objetivo:** `compose()` — encadenar middlewares con `next()`, modelo onion, propagación de errores. Es el corazón del framework.
- **Qué investigar/atacar:** el modelo onion/continuación; qué pasa si un middleware no llama a `next()`; cómo burbujean los errores; cómo se mantienen los tipos a lo largo de la cadena.
- **Lectura:** el código de composición de Hono; docs de Koa sobre middlewares y el modelo onion.
- **Código fuente a leer:** Hono `src/compose.ts`; `koa-compose` (`index.js`).
- **Listo cuando:** los middlewares corren en orden onion, el short-circuit funciona, los errores burbujean; test con 2 handlers + composición + aislamiento del Context.

### 4. Errores de contrato y manejo central

- [ ] **Objetivo:** modelo de errores tipado + un handler de errores central en el pipeline. Errores del framework vs errores del usuario; cómo un middleware los atrapa y mapea.
- **Qué investigar/atacar:** taxonomía de errores; cómo exponer un contrato de error a quien extiende sin filtrar internals; result vs throw.
- **Lectura:** "Simple Testing Can Prevent Most Critical Failures" (la mayoría de las fallas graves son mal manejo de errores); "Release It!" 2da ed., Circuit Breaker y Bulkhead (fronteras de falla).
- **Código fuente a leer:** manejo de errores de Hono (`onError`, `HTTPException`); `UseExceptionHandler` de .NET.
- **Listo cuando:** los errores tienen contrato tipado, el handler central los mapea, un test siembra una falla y verifica el manejo.

### 5. La primera extensión escrita FUERA del núcleo

- [ ] **Objetivo:** probar el contrato de extensión. Escribir un plugin/extensión en un paquete o carpeta aparte que agrega comportamiento sin tocar el núcleo. Es el criterio de aceptación estrella del proyecto.
- **Qué investigar/atacar:** API de registro de extensiones; cómo tipar una extensión para que el Context gane propiedades tipadas (extensión a nivel de tipos: generics o declaration merging).
- **Lectura:** Parnas de nuevo (una extensión es un módulo que esconde una decisión); docs de Fastify "Plugins" y "Decorators".
- **Código fuente a leer:** middleware tipado de Hono (`c.set`/`c.get`, `Variables`); `fastify-plugin`.
- **Listo cuando:** una extensión en un módulo aparte agrega una capacidad tipada al Context; el núcleo queda intacto; sin `any`; el test está escrito desde la mirada de "otro consumidor".

### 6. Inyección de dependencias: registry inmutable → provider

- [ ] **Objetivo:** container de DI mínimo. `ServiceRegistry` (mutable, se configura) → `ServiceProvider` (inmutable, resuelve). Empezar por transient y singleton. Es la columna vertebral, estilo .NET Core.
- **Qué investigar/atacar (la clave del slice):** TS no tiene reflexión de tipos en runtime → hay que decidir entre factories explícitas, tokens (symbol) o decorators + reflect-metadata. Dos etapas (registrar vs resolver); ciclos de vida.
- **Lectura:** Pimple `Container.php` (ciclo de vida de un servicio: cuando una definición se congela); docs de .NET DI sobre service lifetimes.
- **Código fuente a leer:** Pimple `Container.php`; el módulo `trantor-di` del clon local de Trantor; Awilix y tsyringe (dos enfoques opuestos en TS: proxy vs tokens + reflect-metadata).
- **Listo cuando:** registrás un transient y un singleton, los resolvés, el transient da instancias nuevas y el singleton la misma; provider inmutable; test; sin `any`.

### 7. Configuración por providers (merge, tipado)

- [ ] **Objetivo:** sistema de config con varios providers (env, memory, json), gana el último, secciones, y binding tipado a un value object.
- **Qué investigar/atacar:** precedencia/merge, keys anidadas, mapeo de env vars (convención doble underscore), acceso tipado.
- **Lectura:** docs de "Configuration in ASP.NET Core" (el modelo de providers que Trantor copió); "Config" de 12-factor.
- **Código fuente a leer:** el módulo `trantor-config` del clon local; `ConfigurationBuilder` de .NET.
- **Listo cuando:** una env pisa un json, una sección bindea tipada a un objeto; test; sin `any`.

### 8. Hosting y ciclo de vida (host + hosted services)

- [ ] **Objetivo:** un `Host` que es dueño de DI + config + ciclo de vida, y corre `HostedService`s (start/stop) con graceful shutdown. Estilo .NET Generic Host.
- **Qué investigar/atacar:** hooks de ciclo de vida, start/stop ordenado, graceful shutdown con timeout, señales (SIGTERM/SIGINT) en Node, readiness.
- **Lectura:** docs de ".NET Generic Host" (`IHostedService`, `BackgroundService`); una nota sobre graceful shutdown en Node.
- **Código fuente a leer:** el módulo `trantor-hosting` del clon local; `Host`/`HostedService` de .NET.
- **Listo cuando:** el host arranca N hosted services, `run` espera hasta el shutdown, el stop es ordenado y con timeout; test con un servicio falso.

### 9. Módulos (compose/initialize) para componer la app

- [ ] **Objetivo:** sistema de módulos. Un `Module` con `compose` (registra al build) e `initialize` (después del build), agregables y embebibles. Config modular estilo Spring/Laravel.
- **Qué investigar/atacar:** ciclo de dos fases del módulo, submódulos, override (gana el último), cómo un módulo registra DI + config.
- **Lectura:** la sección de módulos de la recorrida de Trantor; "Service Providers" de Laravel o "Modules" de NestJS.
- **Código fuente a leer:** los módulos del clon local de Trantor y su uso en Crafty; `@Module` de NestJS.
- **Listo cuando:** dos módulos componen un app builder, uno embebe un submódulo, `initialize` corre post-build; test.

### 10. Ruteo web (WebApplication con dispatch HTTP) sobre el núcleo

- [ ] **Objetivo:** la capa web. `app.get('/path', handler)`, un router que matchea paths y params, sobre el http de Node, integrando el pipeline + Context. El modo micro-framework de Trantor.
- **Qué investigar/atacar:** routing por trie/radix, tipado de path params, integrar el pipeline y el Context con req/res HTTP; que el ruteo siga siendo un módulo por encima del núcleo.
- **Lectura:** routers de Hono (RegExpRouter/TrieRouter); "radix tree routing" (README de find-my-way).
- **Código fuente a leer:** `src/router/*` de Hono; `find-my-way` (el router de Fastify); el módulo `trantor-web` del clon local.
- **Listo cuando:** registrás rutas con params, un request se despacha end-to-end por el pipeline hasta un handler, params tipados; test; sin `any`.

---

## Más adelante

No entran en los 10, pero se anotan como norte:

- **Eventos:** dispatcher, after-commit, defer, queue/outbox.
- **Jobs:** dispatcher/processor/handlers, retries, dedup.
- **Scheduling:** cron con reloj inyectable.
- **Broadcaster:** websockets server→cliente.
- **Cache:** L1/L2 e invalidación.
- **Aplicación opinionada** con command/query bus.
- **Logging estructurado** con correlation-id/MDC.
- **BOM / multi-paquete.**
