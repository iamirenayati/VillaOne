(function () {
  function csrfToken() {
    const match = document.cookie.match(/(?:^|; )csrftoken=([^;]+)/);
    return match ? decodeURIComponent(match[1]) : "";
  }

  function wrapSelection(textarea, before, after) {
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const value = textarea.value;
    textarea.value = value.slice(0, start) + before + value.slice(start, end) + after + value.slice(end);
    textarea.focus();
    textarea.selectionStart = start + before.length;
    textarea.selectionEnd = end + before.length;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function init() {
    const textarea = document.querySelector("#id_body");
    if (!textarea) return;

    const toolbar = document.createElement("div");
    toolbar.className = "article-editor-toolbar";
    [
      ["H2", "## ", ""],
      ["پررنگ", "**", "**"],
      ["فهرست", "- ", ""],
      ["نقل‌قول", "> ", ""],
    ].forEach(function (item) {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent = item[0];
      button.addEventListener("click", function () { wrapSelection(textarea, item[1], item[2]); });
      toolbar.appendChild(button);
    });
    textarea.parentNode.insertBefore(toolbar, textarea);

    const preview = document.createElement("div");
    preview.className = "article-editor-preview";
    preview.setAttribute("aria-live", "polite");
    preview.innerHTML = "<p>پیش‌نمایش پس از وارد کردن متن نمایش داده می‌شود.</p>";
    textarea.parentNode.appendChild(preview);

    let timer;
    function updatePreview() {
      window.clearTimeout(timer);
      timer = window.setTimeout(function () {
        const path = window.location.pathname.replace(/\/(?:add|\d+\/change)\/?$/, "/preview/");
        const form = new URLSearchParams();
        const match = window.location.pathname.match(/\/(\d+)\/change\/?$/);
        if (match) form.set("article_id", match[1]);
        form.set("body", textarea.value);
        preview.classList.add("is-loading");
        fetch(path, { method: "POST", credentials: "same-origin", headers: { "X-CSRFToken": csrfToken(), "Content-Type": "application/x-www-form-urlencoded" }, body: form.toString() })
          .then(function (response) { if (!response.ok) throw new Error("preview"); return response.json(); })
          .then(function (data) { preview.innerHTML = data.body_html || "<p>پیش‌نمایشی وجود ندارد.</p>"; })
          .catch(function () { preview.innerHTML = "<p class='errornote'>پیش‌نمایش در دسترس نیست.</p>"; })
          .finally(function () { preview.classList.remove("is-loading"); });
      }, 250);
    }
    textarea.addEventListener("input", updatePreview);
    updatePreview();
  }

  document.addEventListener("DOMContentLoaded", init);
}());
