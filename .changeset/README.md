# Changesets

Cada PR que merezca un release lleva un changeset: qué paquete, qué bump (`patch` / `minor` / `major`) y una frase para el changelog.

```bash
pnpm changeset
```

Al mergear a `main`, el workflow de release abre un PR **Version Packages**. Mergear ese PR publica a npm.

**Un paquete nuevo se publica a mano la primera vez**, con `pnpm -r publish --access public`: el trusted publishing de npm se configura sobre un paquete que ya existe, y sin eso el workflow falla con `ENEEDAUTH`. Después se configura el trusted publisher del paquete en npmjs.com (este repo y `release.yml`), y desde ahí publica el workflow.

El workflow arma cada tarball con `pnpm pack`, que reescribe `workspace:*` a la versión exacta, y lo publica con `npm publish`. Un `npm publish` desde la carpeta del paquete dejaría `workspace:*` y el paquete no se podría instalar.
