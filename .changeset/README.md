# Changesets

Cada PR que merezca un release lleva un changeset: qué paquete, qué bump (`patch` / `minor` / `major`) y una frase para el changelog.

```bash
pnpm changeset
```

Al mergear a `main`, el workflow de release abre un PR **Version Packages**. Mergear ese PR publica a npm.
