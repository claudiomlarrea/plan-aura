(function () {
  var CFG = window.IDA_GALERIA || {};
  var albums = CFG.albums || [];
  var root = document.getElementById("galeria-albums");
  if (!root || !albums.length) return;

  var lightbox = null;
  var lightboxImg = null;
  var lightboxVideo = null;
  var currentList = [];
  var currentIndex = 0;

  function isVideo(item) {
    return item && (item.type === "video" || /\.mp4($|\?)/i.test(item.src || ""));
  }

  function ensureLightbox() {
    if (lightbox) return;
    lightbox = document.createElement("div");
    lightbox.className = "gallery-lightbox";
    lightbox.hidden = true;
    lightbox.setAttribute("role", "dialog");
    lightbox.setAttribute("aria-modal", "true");
    lightbox.setAttribute("aria-label", "Vista ampliada");
    lightbox.innerHTML =
      '<button type="button" class="gallery-lightbox-close" aria-label="Cerrar">×</button>' +
      '<button type="button" class="gallery-lightbox-nav gallery-lightbox-prev" aria-label="Anterior">‹</button>' +
      '<img class="gallery-lightbox-img" alt="" />' +
      '<video class="gallery-lightbox-video" controls playsinline></video>' +
      '<button type="button" class="gallery-lightbox-nav gallery-lightbox-next" aria-label="Siguiente">›</button>';
    document.body.appendChild(lightbox);
    lightboxImg = lightbox.querySelector(".gallery-lightbox-img");
    lightboxVideo = lightbox.querySelector(".gallery-lightbox-video");

    lightbox.querySelector(".gallery-lightbox-close").addEventListener("click", closeLightbox);
    lightbox.querySelector(".gallery-lightbox-prev").addEventListener("click", function (e) {
      e.stopPropagation();
      showAt(currentIndex - 1);
    });
    lightbox.querySelector(".gallery-lightbox-next").addEventListener("click", function (e) {
      e.stopPropagation();
      showAt(currentIndex + 1);
    });
    lightbox.addEventListener("click", function (e) {
      if (e.target === lightbox) closeLightbox();
    });
    document.addEventListener("keydown", function (e) {
      if (lightbox.hidden) return;
      if (e.key === "Escape") closeLightbox();
      if (e.key === "ArrowLeft") showAt(currentIndex - 1);
      if (e.key === "ArrowRight") showAt(currentIndex + 1);
    });
  }

  function stopVideo() {
    if (!lightboxVideo) return;
    lightboxVideo.pause();
    lightboxVideo.removeAttribute("src");
    lightboxVideo.load();
    lightboxVideo.hidden = true;
  }

  function showAt(index) {
    if (!currentList.length) return;
    currentIndex = (index + currentList.length) % currentList.length;
    ensureLightbox();
    var item = currentList[currentIndex];
    stopVideo();
    if (isVideo(item)) {
      lightboxImg.hidden = true;
      lightboxImg.removeAttribute("src");
      lightboxVideo.hidden = false;
      if (item.poster) lightboxVideo.setAttribute("poster", item.poster);
      else lightboxVideo.removeAttribute("poster");
      lightboxVideo.src = item.src;
      lightboxVideo.play().catch(function () {});
    } else {
      lightboxImg.hidden = false;
      lightboxImg.src = item.src;
      lightboxImg.alt = item.alt || "";
    }
    lightbox.hidden = false;
    document.body.classList.add("gallery-lightbox-open");
  }

  function closeLightbox() {
    if (!lightbox) return;
    stopVideo();
    lightbox.hidden = true;
    lightboxImg.hidden = false;
    lightboxImg.removeAttribute("src");
    lightboxImg.alt = "";
    document.body.classList.remove("gallery-lightbox-open");
  }

  function fillGrid(grid, photos) {
    if (grid.dataset.filled === "1") return;
    photos.forEach(function (photo, i) {
      var item = document.createElement("button");
      item.type = "button";
      item.className = "gallery-item" + (isVideo(photo) ? " gallery-item--video" : "");
      item.setAttribute("role", "listitem");
      item.setAttribute(
        "aria-label",
        photo.alt ||
          (isVideo(photo) ? "Ver video " : "Ver foto ") + (i + 1) + " de " + photos.length
      );

      var img = document.createElement("img");
      img.src = isVideo(photo) ? photo.poster || photo.src : photo.src;
      img.alt = photo.alt || "";
      img.loading = "lazy";
      img.decoding = "async";
      item.appendChild(img);

      if (isVideo(photo)) {
        var badge = document.createElement("span");
        badge.className = "gallery-video-badge";
        badge.setAttribute("aria-hidden", "true");
        badge.textContent = "▶ Video";
        item.appendChild(badge);
      }

      item.addEventListener("click", function () {
        currentList = photos;
        showAt(i);
      });

      grid.appendChild(item);
    });
    grid.dataset.filled = "1";
  }

  function setOpen(article, toggle, panel, open) {
    article.classList.toggle("is-open", open);
    toggle.setAttribute("aria-expanded", open ? "true" : "false");
    panel.hidden = !open;
  }

  function renderAlbum(album, openByDefault) {
    var photos = album.photos || [];
    var panelId = "galeria-panel-" + album.id;
    var titleId = "galeria-" + album.id;
    var videos = photos.filter(isVideo).length;
    var images = photos.length - videos;
    var metaParts = [];
    if (images) metaParts.push(images + (images === 1 ? " imagen" : " imágenes"));
    if (videos) metaParts.push(videos + (videos === 1 ? " video" : " videos"));

    var article = document.createElement("article");
    article.className = "gallery-event" + (openByDefault ? " is-open" : "");

    var toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "gallery-toggle";
    toggle.id = titleId;
    toggle.setAttribute("aria-controls", panelId);
    toggle.setAttribute("aria-expanded", openByDefault ? "true" : "false");
    toggle.innerHTML =
      '<span class="gallery-toggle-text">' +
      '<span class="gallery-toggle-title"></span>' +
      '<span class="gallery-toggle-meta"></span>' +
      "</span>" +
      '<span class="gallery-toggle-chevron" aria-hidden="true"></span>';
    toggle.querySelector(".gallery-toggle-title").textContent = album.title;
    toggle.querySelector(".gallery-toggle-meta").textContent = metaParts.join(" · ");

    var panel = document.createElement("div");
    panel.className = "gallery-panel";
    panel.id = panelId;
    panel.hidden = !openByDefault;

    if (album.description) {
      var desc = document.createElement("p");
      desc.className = "gallery-panel-desc";
      desc.textContent = album.description;
      panel.appendChild(desc);
    }

    var grid = document.createElement("div");
    grid.className = "gallery-grid";
    grid.setAttribute("role", "list");
    panel.appendChild(grid);

    toggle.addEventListener("click", function () {
      var open = !article.classList.contains("is-open");
      setOpen(article, toggle, panel, open);
      if (open) fillGrid(grid, photos);
    });

    article.appendChild(toggle);
    article.appendChild(panel);
    root.appendChild(article);

    if (openByDefault) fillGrid(grid, photos);
  }

  albums.forEach(function (album, i) {
    renderAlbum(album, i === 0);
  });
})();
