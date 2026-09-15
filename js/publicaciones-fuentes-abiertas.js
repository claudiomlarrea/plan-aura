/**
 * Búsqueda agregada en fuentes abiertas (sin APIs de pago).
 * OpenAlex, Crossref, Semantic Scholar, Europe PMC (incl. PubMed); enriquecimiento Unpaywall por DOI.
 */
(function (global) {
  var MIN_YEAR = 1950;

  var ETIQUETA_FUENTE = {
    openalex: "OpenAlex",
    crossref: "Crossref",
    semanticscholar: "Semantic Scholar",
    europepmc: "Europe PMC",
    openaire: "OpenAIRE",
    doaj: "DOAJ"
  };

  var QUERY_IA = "artificial intelligence";
  var QUERY_SD = "sustainable development";
  var QUERY_AGUA =
    '("water consumption" OR "responsible water use" OR "rational water use" OR "water conservation" OR "water saving" OR "sustainable water use" OR "water reuse" OR "water scarcity" OR "water quality" OR "water education")';

  function currentYear() {
    return new Date().getFullYear();
  }

  function maxPubDate() {
    return new Date().toISOString().slice(0, 10);
  }

  function fetchJson(url, headers) {
    return fetch(url, { method: "GET", headers: headers || { Accept: "application/json" } }).then(function (r) {
      if (!r.ok) throw new Error("http-" + r.status);
      return r.json();
    });
  }

  function normalizarDoi(raw) {
    var s = String(raw || "").trim();
    s = s.replace(/^https?:\/\/(?:dx\.)?doi\.org\//i, "");
    s = s.replace(/^doi:\s*/i, "");
    return s.trim();
  }

  function anioValido(anio) {
    var y = Number(anio);
    return y >= MIN_YEAR && y <= currentYear();
  }

  function normalizarItem(partial) {
    var doi = normalizarDoi(partial.doi);
    var anio = partial.anio;
    if (anio && !anioValido(anio)) anio = "";
    return {
      titulo: partial.titulo || "Sin título",
      autores: partial.autores || "",
      doi: doi,
      link: partial.link || (doi ? "https://doi.org/" + doi : ""),
      anio: anio || "",
      tipo: partial.tipo || "Trabajo académico",
      fuente: partial.fuente || "",
      oaUrl: partial.oaUrl || ""
    };
  }

  function claveDedupe(item) {
    if (item.doi) return "doi:" + item.doi.toLowerCase();
    return (
      "t:" +
      String(item.titulo || "")
        .toLowerCase()
        .replace(/\s+/g, " ")
        .trim() +
      "|" +
      String(item.anio || "")
    );
  }

  function fusionar(listas) {
    var map = {};
    var orden = [];
    listas.forEach(function (lista) {
      (lista || []).forEach(function (raw) {
        var item = normalizarItem(raw);
        if (item.anio && !anioValido(item.anio)) return;
        var key = claveDedupe(item);
        if (!map[key]) {
          map[key] = item;
          orden.push(key);
        } else {
          var prev = map[key];
          if (!prev.doi && item.doi) prev.doi = item.doi;
          if (!prev.link && item.link) prev.link = item.link;
          if (!prev.oaUrl && item.oaUrl) prev.oaUrl = item.oaUrl;
          if (prev.fuente && item.fuente && prev.fuente.indexOf(item.fuente) < 0) {
            prev.fuente = prev.fuente + " · " + item.fuente;
          }
        }
      });
    });
    return orden.map(function (k) {
      return map[k];
    });
  }

  function ordenar(items, sortMode, tieneBusqueda) {
    var list = items.slice();
    if (sortMode === "relevance" && tieneBusqueda) return list;
    list.sort(function (a, b) {
      var ya = Number(a.anio) || 0;
      var yb = Number(b.anio) || 0;
      if (sortMode === "date_asc") {
        if (ya !== yb) return ya - yb;
      } else {
        if (ya !== yb) return yb - ya;
      }
      return String(a.titulo).localeCompare(String(b.titulo), "es");
    });
    return list;
  }

  function resolverModo(query, searchMode) {
    var q = String(query || "").trim();
    var modo = searchMode || "auto";
    if (modo !== "auto") return modo;
    if (/^10\.\d{3,}/i.test(normalizarDoi(q))) return "doi";
    if (q.indexOf(",") >= 0) return "author";
    var partes = q.split(/\s+/).filter(Boolean);
    if (partes.length >= 2 && partes.length <= 6) {
      var may = partes.filter(function (w) {
        return /^[\p{Lu}]/u.test(w);
      }).length;
      if (may >= 2) return "author";
    }
    if (partes.length === 1 && partes[0].length >= 3 && /^[\p{L}]/u.test(partes[0])) return "author";
    return "title";
  }

  function textoAutor(q) {
    return String(q || "")
      .trim()
      .replace(/\s*,\s*/g, " ")
      .replace(/\s+/g, " ")
      .trim();
  }

  function openAlexHeaders(mailto, appLabel) {
    return {
      Accept: "application/json",
      "User-Agent": "mailto:" + mailto + " (" + appLabel + ")"
    };
  }

  function queryPorDefecto(opts) {
    if (opts.defaultQuery) return String(opts.defaultQuery);
    if (opts.scope === "sd-global") return QUERY_SD;
    if (opts.scope === "ia-global") return QUERY_IA;
    if (opts.scope === "agua-global") return QUERY_AGUA;
    return "Universidad Católica de Cuyo";
  }

  function filtroOpenAlex(opts, modo) {
    var parts = [];
    if (opts.scope === "ia-global") {
      parts.push("concepts.id:" + (opts.conceptId || opts.iaConceptId));
      parts.push("to_publication_date:" + maxPubDate());
      if (opts.yearFilter === "all") parts.push("from_publication_date:" + MIN_YEAR + "-01-01");
    } else if (opts.scope === "sd-global") {
      parts.push("has_sdgs:true");
      parts.push("to_publication_date:" + maxPubDate());
      if (opts.yearFilter === "all") parts.push("from_publication_date:" + MIN_YEAR + "-01-01");
    } else if (opts.scope === "agua-global") {
      // Conceptos alineados al Plan AURA (conservación, recursos, escasez, calidad, GIRH, gestión)
      var aguaConcepts =
        opts.conceptId ||
        "C110158866|C153823671|C51193700|C2780797713|C96306036|C524765639";
      parts.push("concepts.id:" + aguaConcepts);
      parts.push("to_publication_date:" + maxPubDate());
      if (opts.yearFilter === "all") parts.push("from_publication_date:" + MIN_YEAR + "-01-01");
    } else {
      parts.push("authorships.institutions.lineage:" + opts.institutionId);
    }
    if (opts.yearFilter !== "all") parts.push("publication_year:" + opts.yearFilter);

    var q = String(opts.searchQuery || "").trim();
    if (!q) return parts.join(",");

    if (modo === "doi") {
      var doi = normalizarDoi(q);
      if (/^10\.\d{4,}.+\/.+/i.test(doi)) parts.push("doi:" + doi);
      else parts.push("doi_starts_with:" + doi);
    } else if (modo === "author") {
      parts.push("raw_author_name.search:" + textoAutor(q));
    } else {
      parts.push("display_name.search:" + q);
    }
    return parts.join(",");
  }

  function fetchOpenAlex(opts, modo) {
    var params = new URLSearchParams();
    params.set("filter", filtroOpenAlex(opts, modo));
    var sort = "publication_date:desc";
    if (opts.sortMode === "date_asc") sort = "publication_date:asc";
    else if (opts.sortMode === "relevance" && opts.searchQuery.trim()) sort = "relevance_score:desc";
    params.set("sort", sort);
    params.set("per-page", String(opts.pageSize));
    params.set("page", String(opts.page));
    if (opts.mailto) params.set("mailto", opts.mailto);

    var url = "https://api.openalex.org/works?" + params.toString();
    return fetchJson(url, openAlexHeaders(opts.mailto, opts.appLabel)).then(function (data) {
      var results = (data && data.results) || [];
      var items = results.map(function (w) {
        var doi = w.doi ? normalizarDoi(w.doi) : "";
        var autores = ((w.authorships || [])
          .map(function (a) {
            return a && a.author && a.author.display_name;
          })
          .filter(Boolean)).join(", ");
        var loc = w.primary_location || {};
        return normalizarItem({
          titulo: w.display_name,
          autores: autores,
          doi: doi,
          link: doi ? "https://doi.org/" + doi : loc.landing_page_url || loc.pdf_url || w.id || "",
          anio: w.publication_year,
          tipo: (w.type || "Trabajo").replace(/-/g, " "),
          fuente: ETIQUETA_FUENTE.openalex
        });
      });
      return {
        items: items,
        total: Number(data && data.meta && data.meta.count) || 0,
        page: Number(data && data.meta && data.meta.page) || opts.page
      };
    });
  }

  function queryCrossref(opts, modo) {
    var q = String(opts.searchQuery || "").trim();
    if (modo === "doi") return normalizarDoi(q);
    if (modo === "author") return "author:" + textoAutor(q);
    if (q) return q;
    return queryPorDefecto(opts);
  }

  function fetchCrossref(opts, modo) {
    var mailto = encodeURIComponent(opts.mailto);
    var offset = (opts.page - 1) * opts.pageSize;
    var filters = ["from-pub-date:" + MIN_YEAR, "until-pub-date:" + maxPubDate()];
    if (opts.yearFilter !== "all") {
      filters = ["from-pub-date:" + opts.yearFilter + "-01-01", "until-pub-date:" + opts.yearFilter + "-12-31"];
    }

    if (modo === "doi") {
      var doi = normalizarDoi(opts.searchQuery);
      var singleUrl =
        "https://api.crossref.org/works/" + encodeURIComponent(doi) + "?mailto=" + mailto;
      return fetchJson(singleUrl).then(function (data) {
        var m = data && data.message;
        if (!m) return { items: [], total: 0 };
        var item = mapCrossrefWork(m);
        return { items: item ? [item] : [], total: item ? 1 : 0 };
      });
    }

    var url =
      "https://api.crossref.org/works?query=" +
      encodeURIComponent(queryCrossref(opts, modo)) +
      "&rows=" +
      opts.pageSize +
      "&offset=" +
      offset +
      "&filter=" +
      encodeURIComponent(filters.join(",")) +
      "&mailto=" +
      mailto;

    return fetchJson(url).then(function (data) {
      var msg = data && data.message;
      var items = ((msg && msg.items) || []).map(mapCrossrefWork).filter(Boolean);
      return { items: items, total: Number(msg && msg["total-results"]) || 0 };
    });
  }

  function mapCrossrefWork(m) {
    if (!m) return null;
    var doi = m.DOI ? normalizarDoi(m.DOI) : "";
    var titulo =
      (m.title && m.title[0]) ||
      (m["container-title"] && m["container-title"][0]) ||
      "Sin título";
    var autores = (m.author || [])
      .map(function (a) {
        var n = [a.given, a.family].filter(Boolean).join(" ");
        return n || a.name;
      })
      .filter(Boolean)
      .join(", ");
    var anio = "";
    if (m.issued && m.issued["date-parts"] && m.issued["date-parts"][0]) {
      anio = m.issued["date-parts"][0][0];
    }
    var tipo = (m.type || "document").replace(/-/g, " ");
    return normalizarItem({
      titulo: titulo,
      autores: autores,
      doi: doi,
      link: doi ? "https://doi.org/" + doi : m.URL || "",
      anio: anio,
      tipo: tipo,
      fuente: ETIQUETA_FUENTE.crossref
    });
  }

  function querySemanticScholar(opts, modo) {
    var q = String(opts.searchQuery || "").trim();
    if (modo === "doi") return "DOI:" + normalizarDoi(q);
    if (modo === "author") return "authors:" + textoAutor(q);
    if (q) return q;
    return queryPorDefecto(opts);
  }

  function fetchSemanticScholar(opts, modo) {
    var offset = (opts.page - 1) * opts.pageSize;
    var fields =
      "paperId,title,authors,year,externalIds,url,publicationTypes,openAccessPdf,journal";
    var url =
      "https://api.semanticscholar.org/graph/v1/paper/search?query=" +
      encodeURIComponent(querySemanticScholar(opts, modo)) +
      "&offset=" +
      offset +
      "&limit=" +
      opts.pageSize +
      "&fields=" +
      fields;

    return fetchJson(url).then(function (data) {
      var papers = (data && data.data) || [];
      var items = papers
        .map(function (p) {
          var doi = "";
          if (p.externalIds && p.externalIds.DOI) doi = normalizarDoi(p.externalIds.DOI);
          var autores = (p.authors || [])
            .map(function (a) {
              return a.name;
            })
            .filter(Boolean)
            .join(", ");
          var pdf = p.openAccessPdf && p.openAccessPdf.url;
          var tipo = (p.publicationTypes && p.publicationTypes[0]) || "Artículo";
          if (opts.yearFilter !== "all" && String(p.year) !== String(opts.yearFilter)) return null;
          return normalizarItem({
            titulo: p.title,
            autores: autores,
            doi: doi,
            link: pdf || p.url || (doi ? "https://doi.org/" + doi : ""),
            anio: p.year,
            tipo: tipo,
            fuente: ETIQUETA_FUENTE.semanticscholar,
            oaUrl: pdf || ""
          });
        })
        .filter(Boolean);
      return { items: items, total: Number(data && data.total) || 0 };
    });
  }

  function queryEuropePMC(opts, modo) {
    var parts = [];
    var q = String(opts.searchQuery || "").trim();
    if (modo === "doi") {
      parts.push('DOI:"' + normalizarDoi(q) + '"');
    } else if (modo === "author") {
      parts.push('AUTH:"' + textoAutor(q).replace(/"/g, "") + '"');
    } else if (modo === "title" && q) {
      parts.push('TITLE:"' + q.replace(/"/g, "") + '"');
    } else if (q) {
      parts.push(q.replace(/"/g, ""));
    } else if (opts.scope === "sd-global") {
      parts.push('(TITLE:"sustainable development" OR ABSTRACT:"sustainable development" OR TITLE:"desarrollo sostenible" OR ABSTRACT:"desarrollo sostenible")');
    } else if (opts.scope === "ia-global") {
      parts.push('(TITLE:"artificial intelligence" OR ABSTRACT:"artificial intelligence")');
    } else if (opts.scope === "agua-global") {
      parts.push(
        '(TITLE:"water consumption" OR ABSTRACT:"water consumption" OR TITLE:"responsible water use" OR ABSTRACT:"responsible water use" OR TITLE:"water conservation" OR ABSTRACT:"water conservation" OR TITLE:"rational water use" OR ABSTRACT:"rational water use" OR TITLE:"uso responsable del agua" OR ABSTRACT:"uso responsable del agua" OR TITLE:"ahorro de agua" OR ABSTRACT:"ahorro de agua")'
      );
    } else {
      parts.push(
        '(AFF:"Universidad Católica de Cuyo" OR AFF:"Universidad Catolica de Cuyo" OR AFF:"Catholic University of Cuyo")'
      );
    }
    if (opts.yearFilter !== "all") parts.push("PUB_YEAR:" + opts.yearFilter);
    else parts.push("PUB_YEAR:[" + MIN_YEAR + " TO " + currentYear() + "]");
    return parts.join(" AND ");
  }

  function fetchEuropePMC(opts, modo) {
    var url =
      "https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=" +
      encodeURIComponent(queryEuropePMC(opts, modo)) +
      "&format=json&pageSize=" +
      opts.pageSize +
      "&page=" +
      opts.page +
      "&resultType=core";

    return fetchJson(url).then(function (data) {
      var result = data && data.resultList && data.resultList.result;
      var list = Array.isArray(result) ? result : result ? [result] : [];
      var items = list
        .map(function (r) {
          var doi = r.doi ? normalizarDoi(r.doi) : "";
          var autores = r.authorString || "";
          var anio = r.pubYear || "";
          var link = r.doi ? "https://doi.org/" + r.doi : "";
          if (!link && r.pmcid) link = "https://europepmc.org/article/MED/" + r.pmcid;
          if (!link && r.pmid) link = "https://pubmed.ncbi.nlm.nih.gov/" + r.pmid + "/";
          var tipo = r.pubTypeList && r.pubTypeList.pubType;
          tipo = Array.isArray(tipo) ? tipo[0] : tipo || "Artículo";
          return normalizarItem({
            titulo: r.title,
            autores: autores,
            doi: doi,
            link: link,
            anio: anio,
            tipo: tipo,
            fuente: ETIQUETA_FUENTE.europepmc
          });
        })
        .filter(function (it) {
          return it.titulo && (!it.anio || anioValido(it.anio));
        });
      return {
        items: items,
        total: Number(data && data.hitCount) || 0
      };
    });
  }

  function textoNodo(node) {
    if (node == null) return "";
    if (typeof node === "string" || typeof node === "number") return String(node);
    if (Array.isArray(node)) return textoNodo(node[0]);
    if (node.$) return String(node.$);
    if (node["#text"]) return String(node["#text"]);
    return "";
  }

  function mapOpenAIRE(result) {
    var entity =
      result &&
      result.metadata &&
      result.metadata["oaf:entity"] &&
      result.metadata["oaf:entity"]["oaf:result"];
    if (!entity) entity = result && result.metadata;
    if (!entity) return null;
    var titulo = textoNodo(entity.title) || textoNodo(entity.resulttitle);
    if (!titulo) return null;
    var creators = entity.creator || entity.creators || [];
    if (!Array.isArray(creators)) creators = [creators];
    var autores = creators
      .map(function (c) {
        return textoNodo(c) || (c && (c.surname || c.name)) || "";
      })
      .filter(Boolean)
      .join(", ");
    var anio = textoNodo(entity.dateofacceptance) || textoNodo(entity.year);
    if (anio) anio = String(anio).slice(0, 4);
    var doi = "";
    var pids = entity.pid || [];
    if (!Array.isArray(pids)) pids = [pids];
    pids.forEach(function (p) {
      var cls = (p && p["@classid"]) || (p && p.classid) || "";
      if (String(cls).toLowerCase() === "doi") doi = normalizarDoi(textoNodo(p));
    });
    return normalizarItem({
      titulo: titulo,
      autores: autores,
      doi: doi,
      link: doi ? "https://doi.org/" + doi : "",
      anio: anio,
      tipo: "Publicación",
      fuente: ETIQUETA_FUENTE.openaire
    });
  }

  function fetchOpenAIRE(opts, modo) {
    var q = String(opts.searchQuery || "").trim();
    if (modo === "doi") q = normalizarDoi(q);
    else if (modo === "author") q = textoAutor(q);
    else if (!q) q = queryPorDefecto(opts);
    var url =
      "https://api.openaire.eu/search/publications?keywords=" +
      encodeURIComponent(q) +
      "&format=json&page=" +
      opts.page +
      "&size=" +
      opts.pageSize;
    return fetchJson(url).then(function (data) {
      var results = data && data.response && data.response.results && data.response.results.result;
      if (!results) results = [];
      if (!Array.isArray(results)) results = [results];
      var totalNode = data && data.response && data.response.header && data.response.header.total;
      var total = Number(textoNodo(totalNode) || (totalNode && totalNode.$) || 0);
      return { items: results.map(mapOpenAIRE).filter(Boolean), total: total };
    });
  }

  function fetchDOAJ(opts, modo) {
    var q = String(opts.searchQuery || "").trim();
    if (modo === "doi") q = normalizarDoi(q);
    else if (modo === "author") q = textoAutor(q);
    else if (!q) q = queryPorDefecto(opts);
    var url =
      "https://doaj.org/api/search/articles/" +
      encodeURIComponent(q) +
      "?page=" +
      opts.page +
      "&pageSize=" +
      opts.pageSize;
    return fetchJson(url).then(function (data) {
      var results = (data && data.results) || [];
      var items = results.map(function (r) {
        var b = (r && r.bibjson) || {};
        var doi = "";
        (b.identifier || []).forEach(function (id) {
          if (id && String(id.type).toLowerCase() === "doi") doi = normalizarDoi(id.id);
        });
        var autores = (b.author || [])
          .map(function (a) {
            return a && a.name;
          })
          .filter(Boolean)
          .join(", ");
        var link = "";
        if (b.link && b.link[0] && b.link[0].url) link = b.link[0].url;
        return normalizarItem({
          titulo: b.title,
          autores: autores,
          doi: doi,
          link: link || (doi ? "https://doi.org/" + doi : ""),
          anio: b.year,
          tipo: "Artículo",
          fuente: ETIQUETA_FUENTE.doaj
        });
      });
      return { items: items, total: Number(data && data.total) || items.length };
    });
  }

  function conTiempo(promesa, ms) {
    return Promise.race([
      promesa,
      new Promise(function (_, reject) {
        window.setTimeout(function () {
          reject(new Error("timeout"));
        }, ms || 8000);
      })
    ]);
  }

  function enrichUnpaywall(items, mailto) {
    var conDoi = items.filter(function (it) {
      return it.doi && !it.oaUrl;
    });
    if (!conDoi.length) return Promise.resolve(items);

    var email = encodeURIComponent(mailto);
    return Promise.all(
      conDoi.map(function (it) {
        var url = "https://api.unpaywall.org/v2/" + encodeURIComponent(it.doi) + "?email=" + email;
        return fetchJson(url)
          .then(function (data) {
            if (!data || !data.is_oa) return;
            var best = data.best_oa_location;
            if (!best) return;
            if (best.url_for_pdf) it.oaUrl = best.url_for_pdf;
            else if (best.url) it.oaUrl = best.url;
            if (it.oaUrl && (!it.link || it.link.indexOf("doi.org") >= 0)) it.link = it.oaUrl;
          })
          .catch(function () {
            /* Unpaywall opcional */
          });
      })
    ).then(function () {
      return items;
    });
  }

  function buscar(opts) {
    var modo = resolverModo(opts.searchQuery, opts.searchMode);
    var base = {
      scope: opts.scope || "uccuyo",
      institutionId: opts.institutionId || "",
      iaConceptId: opts.iaConceptId || opts.conceptId || "C154945302",
      conceptId: opts.conceptId || opts.iaConceptId || "C154945302",
      defaultQuery: opts.defaultQuery || "",
      mailto: opts.mailto || "investigacion@uccuyo.edu.ar",
      appLabel: opts.appLabel || "UCCuyo publicaciones",
      page: opts.page || 1,
      pageSize: opts.pageSize || 15,
      searchQuery: opts.searchQuery || "",
      searchMode: opts.searchMode || "auto",
      yearFilter: opts.yearFilter || "all",
      sortMode: opts.sortMode || "date_desc"
    };

    var adapters = [
      { key: "openalex", fn: fetchOpenAlex },
      { key: "crossref", fn: fetchCrossref },
      { key: "semanticscholar", fn: fetchSemanticScholar },
      { key: "europepmc", fn: fetchEuropePMC }
    ];
    if (base.scope === "sd-global") {
      adapters.push({ key: "openaire", fn: fetchOpenAIRE });
      adapters.push({ key: "doaj", fn: fetchDOAJ });
    }

    return Promise.all(
      adapters.map(function (a) {
        var extra = a.key === "openaire" || a.key === "doaj";
        var run = extra ? conTiempo(a.fn(base, modo), 8000) : a.fn(base, modo);
        return run
          .then(function (res) {
            return { key: a.key, ok: true, items: res.items, total: res.total, page: res.page };
          })
          .catch(function () {
            return { key: a.key, ok: false, items: [], total: 0 };
          });
      })
    ).then(function (partes) {
      var listas = partes.map(function (p) {
        return p.items;
      });
      var fusionados = fusionar(listas);
      var tieneBusqueda = !!String(base.searchQuery).trim();
      fusionados = ordenar(fusionados, base.sortMode, tieneBusqueda);
      var mostrar = fusionados.slice(0, base.pageSize);

      var totalOpenAlex = 0;
      var pageOpenAlex = base.page;
      partes.forEach(function (p) {
        if (p.key === "openalex" && p.ok) {
          totalOpenAlex = p.total;
          pageOpenAlex = p.page || base.page;
        }
      });
      var metaTotal = totalOpenAlex || Math.max.apply(
        null,
        partes.map(function (p) {
          return p.total || 0;
        })
      );

      var fuentesActivas = partes.filter(function (p) {
        return p.ok;
      }).length;
      var fuentesFallidas = partes
        .filter(function (p) {
          return !p.ok;
        })
        .map(function (p) {
          return ETIQUETA_FUENTE[p.key] || p.key;
        });

      return enrichUnpaywall(mostrar, base.mailto).then(function (enriquecidos) {
        return {
          items: enriquecidos,
          metaTotal: metaTotal,
          currentPage: pageOpenAlex,
          totalPages: Math.max(1, Math.ceil(metaTotal / base.pageSize)),
          fuentesActivas: fuentesActivas,
          fuentesFallidas: fuentesFallidas,
          modo: modo
        };
      });
    });
  }

  global.PUB_FUENTES_ABIERTAS = {
    buscar: buscar,
    ETIQUETA_FUENTE: ETIQUETA_FUENTE
  };
})(window);
