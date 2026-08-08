# Plan AURA · UCCuyo

Sitio del **Plan Integral AURA** (Universidad Católica de Cuyo).

**Dominio:** https://plan-aura.com.ar/

## Publicación

Este directorio debe publicarse como **repositorio GitHub Pages independiente**
(no como subcarpeta del Observatorio), para que el dominio apunte solo al Plan AURA.

1. Crear repo `plan-aura` en GitHub (público).
2. Subir el contenido de esta carpeta en la raíz del repo.
3. Settings → Pages → Branch `main` / root.
4. Settings → Pages → Custom domain: `plan-aura.com.ar` (HTTPS).

## DNS en NIC.ar (después del registro)

En el panel del dominio `plan-aura.com.ar` → **Delegación / DNS**:

### Opción recomendada (dominio raíz)

Registros **A** para `@` / `plan-aura.com.ar`:

| Tipo | Nombre | Valor |
|------|--------|--------|
| A | @ (o plan-aura.com.ar) | 185.199.108.153 |
| A | @ | 185.199.109.153 |
| A | @ | 185.199.110.153 |
| A | @ | 185.199.111.153 |

Y **CNAME** para `www`:

| Tipo | Nombre | Valor |
|------|--------|--------|
| CNAME | www | claudiomlarrea.github.io |

Luego en GitHub Pages marcá “Enforce HTTPS”.

La propagación DNS puede demorar minutos u horas.
