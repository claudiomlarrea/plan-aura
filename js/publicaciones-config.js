/**
 * Configuración Biblioteca del Agua / visitas (Apps Script compartido).
 * Temas derivados del Plan AURA (Res. 418-CS-2024, 767-CS-2025, 849-CS-2026,
 * 620-R-2025) y de los ejes de la convocatoria de investigación y extensión.
 */
window.OBS_PUBLICACIONES = {
  APPS_SCRIPT_URL:
    "https://script.google.com/a/macros/uccuyo.edu.ar/s/AKfycbxXOx3XpKzmpffpUFJ9tLctA5FR-552RbggS4pLO2KrL3mpVVZuKyGBFdnXDC3qR5zH/exec",
  OPENALEX_MAILTO: "luisjimenez@uccuyo.edu.ar",
  OPENALEX_PAGE_SIZE: 15,
  /* Query para Crossref / Semantic Scholar / Europe PMC */
  AGUA_DEFAULT_QUERY:
    '"water consumption" OR "responsible water use" OR "rational water use" OR "water conservation" OR "water saving" OR "sustainable water use" OR "water reuse" OR "water scarcity" OR "water education" OR "water quality" OR "household water" OR "water policy" OR "arid region" OR "water metering" OR "water behaviour" OR "uso responsable del agua" OR "ahorro de agua" OR "cultura hídrica"',
  /* Filtro OpenAlex (default.search) alineado a los ejes AURA */
  AGUA_OPENALEX_SEARCH:
    '"water conservation"|"water saving"|"responsible water use"|"rational water use"|"water consumption"|"water reuse"|"water scarcity"|"water education"|"water quality"|"household water access"|"water policy"|"arid water"|"water metering"|"water behaviour"|"water behavior"|"hydric culture"'
};
