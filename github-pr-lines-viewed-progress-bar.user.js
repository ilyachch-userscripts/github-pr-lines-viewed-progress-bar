// ==UserScript==
// @name         GitHub PR: Lines Viewed Progress Bar
// @namespace    https://github.com/ilyachch-userscripts/
// @version      1.1
// @description  Adds a progress bar to GitHub PRs showing the number of lines viewed based on reviewed checkboxes.
// @author       ilyachch
// @homepage     https://github.com/ilyachch-userscripts/github-pr-lines-viewed-progress-bar
// @source       https://raw.githubusercontent.com/ilyachch-userscripts/github-pr-lines-viewed-progress-bar/main/github-pr-lines-viewed-progress-bar.user.js
// @supportURL   https://github.com/ilyachch-userscripts/github-pr-lines-viewed-progress-bar/issues
// @updateURL    https://raw.githubusercontent.com/ilyachch-userscripts/github-pr-lines-viewed-progress-bar/main/github-pr-lines-viewed-progress-bar.user.js
// @downloadURL  https://raw.githubusercontent.com/ilyachch-userscripts/github-pr-lines-viewed-progress-bar/main/github-pr-lines-viewed-progress-bar.user.js
// @license      MIT
// @run-at       document-idle
// @match        https://github.com/*/*/pull/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=github.com
// ==/UserScript==

(function () {
  "use strict";

  const SELECTORS = {
    fileContainer: ".file",
    reviewedCheckbox: ".js-reviewed-checkbox",
    fileInfo: ".file-info",
    toolsContainer: ".pr-review-tools",
  };

  const MY_ID = "tm-lines-progress-bar";
  let debounceTimer = null;

  function getChangesFromFile(fileElement) {
    const diffStat = fileElement.querySelector("span.diffstat");
    if (!diffStat) return 0;

    const rawValue = (diffStat.textContent || "").trim();
    if (!rawValue) return 0;

    const numericValue = parseInt(rawValue.replace(/,/g, ""), 10);
    return Number.isNaN(numericValue) ? 0 : numericValue;
  }

  function calculateAndDisplay() {
    const files = document.querySelectorAll(SELECTORS.fileContainer);
    if (files.length === 0) return;

    let totalLines = 0;
    let viewedLines = 0;
    let visibleFilesCount = 0;

    files.forEach((file) => {
      const checkbox = file.querySelector(SELECTORS.reviewedCheckbox);
      if (checkbox) {
        visibleFilesCount++;
        const lines = getChangesFromFile(file);
        totalLines += lines;

        if (checkbox.checked) {
          viewedLines += lines;
        }
      }
    });

    if (visibleFilesCount === 0) return;

    renderProgressBar(viewedLines, totalLines);
  }

  function renderProgressBar(viewed, total) {
    const container = document.querySelector(SELECTORS.toolsContainer);
    if (!container) return;

    let myWrapper = document.getElementById(MY_ID);

    if (!myWrapper) {
      myWrapper = document.createElement("span");
      myWrapper.id = MY_ID;
      myWrapper.className = "diffbar-item hide-md hide-sm mr-3";
      myWrapper.style.minWidth = "130px";

      myWrapper.innerHTML = `
                <div class="d-flex flex-column width-full">
                  <div class="d-flex flex-justify-center flex-items-center width-full mb-1">
                    <div class="text-small">
                      <span id="${MY_ID}-count" style="font-weight: 600;"></span> lines viewed
                    </div>
                  </div>
                  <span class="Progress mt-n1">
                    <div id="${MY_ID}-bar" class="color-bg-accent-emphasis" style="transition: width 0.2s ease-out; width: 0%; height: 100%;"></div>
                  </span>
                </div>
            `;

      container.insertBefore(myWrapper, container.firstChild);
    }

    const countSpan = document.getElementById(`${MY_ID}-count`);
    const barDiv = document.getElementById(`${MY_ID}-bar`);

    if (countSpan && barDiv) {
      const percentage = total === 0 ? 0 : (viewed / total) * 100;

      const formattedViewed = new Intl.NumberFormat("en-US").format(viewed);
      const formattedTotal = new Intl.NumberFormat("en-US").format(total);

      const text = `${formattedViewed} / ${formattedTotal}`;

      if (countSpan.textContent !== text) {
        countSpan.textContent = text;
      }

      barDiv.style.width = `${percentage}%`;

      if (percentage >= 100) {
        barDiv.classList.remove("color-bg-accent-emphasis");
        barDiv.classList.add("color-bg-success-emphasis");
      } else {
        barDiv.classList.add("color-bg-accent-emphasis");
        barDiv.classList.remove("color-bg-success-emphasis");
      }
    }
  }

  function scheduleUpdate() {
    if (debounceTimer) clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      calculateAndDisplay();
    }, 250);
  }

  function init() {
    scheduleUpdate();

    document.addEventListener("change", (e) => {
      if (e.target.matches(SELECTORS.reviewedCheckbox)) {
        setTimeout(calculateAndDisplay, 50);
      }
    });

    const observer = new MutationObserver((mutations) => {
      let shouldUpdate = false;
      for (let mutation of mutations) {
        if (
          mutation.target.id === MY_ID ||
          (mutation.target.closest && mutation.target.closest("#" + MY_ID))
        ) {
          continue;
        }
        shouldUpdate = true;
      }
      if (shouldUpdate) scheduleUpdate();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  }

  init();
})();
