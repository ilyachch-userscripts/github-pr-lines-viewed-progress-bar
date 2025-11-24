// ==UserScript==
// @name         GitHub PR: Lines Viewed Progress Bar
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Adds a progress bar to GitHub PRs showing the number of lines viewed based on reviewed checkboxes.
// @author       ilyachch
// @homepage     https://github.com/ilyachch-userscripts/github-pr-lines-viewed-progress-bar
// @source       https://raw.githubusercontent.com/ilyachch-userscripts/github-pr-lines-viewed-progress-bar/main/github-pr-lines-viewed-progress-bar.user.js
// @supportURL   https://github.com/ilyachch-userscripts/github-pr-lines-viewed-progress-bar/issues
// @updateURL    https://raw.githubusercontent.com/ilyachch-userscripts/github-pr-lines-viewed-progress-bar/main/github-pr-lines-viewed-progress-bar.user.js
// @downloadURL  https://raw.githubusercontent.com/ilyachch-userscripts/github-pr-lines-viewed-progress-bar/main/github-pr-lines-viewed-progress-bar.user.js
// @license      MIT
//
// @run-at       document-end
// @match        https://github.com/*/*/pull/*
// @icon         https://www.google.com/s2/favicons?sz=64&domain=github.com
// ==/UserScript==

(function() {
    'use strict';

    // --- КОНФИГУРАЦИЯ ---
    const SELECTORS = {
        fileContainer: '.file',
        reviewedCheckbox: '.js-reviewed-checkbox',
        fileInfo: '.file-info',
        // Панель инструментов, куда будем встраиваться
        toolsContainer: '.pr-review-tools',
    };

    const MY_ID = 'tm-lines-progress-bar';
    let debounceTimer = null;

    // --- ФУНКЦИИ ПАРСИНГА ---
    function getChangesFromFile(fileElement) {
        const infoBlock = fileElement.querySelector(SELECTORS.fileInfo);
        if (!infoBlock) return 0;

        const textContent = infoBlock.textContent || "";

        // 1. "X additions & Y deletions" (текст)
        const addTextMatch = textContent.match(/(\d+)\s+additions?/i);
        const delTextMatch = textContent.match(/(\d+)\s+deletions?/i);
        if (addTextMatch || delTextMatch) {
            const a = addTextMatch ? parseInt(addTextMatch[1], 10) : 0;
            const d = delTextMatch ? parseInt(delTextMatch[1], 10) : 0;
            return a + d;
        }

        // 2. Title атрибуты
        const diffStat = infoBlock.querySelector('.diffstat');
        const titleText = (diffStat && diffStat.getAttribute('title')) || infoBlock.getAttribute('title') || "";
        const addTitleMatch = titleText.match(/(\d+)\s+additions?/i);
        const delTitleMatch = titleText.match(/(\d+)\s+deletions?/i);
        if (addTitleMatch || delTitleMatch) {
            const a = addTitleMatch ? parseInt(addTitleMatch[1], 10) : 0;
            const d = delTitleMatch ? parseInt(delTitleMatch[1], 10) : 0;
            return a + d;
        }

        // 3. "+X -Y"
        const plusMatch = textContent.match(/\+\s*(\d+)/);
        const minusMatch = textContent.match(/[-−—]\s*(\d+)/); // Разные виды минусов
        if (plusMatch || minusMatch) {
             const a = plusMatch ? parseInt(plusMatch[1], 10) : 0;
             const d = minusMatch ? parseInt(minusMatch[1], 10) : 0;
             return a + d;
        }

        return 0;
    }

    // --- ОСНОВНАЯ ЛОГИКА ---
    function calculateAndDisplay() {
        const files = document.querySelectorAll(SELECTORS.fileContainer);
        if (files.length === 0) return;

        let totalLines = 0;
        let viewedLines = 0;
        let visibleFilesCount = 0;

        files.forEach(file => {
            const checkbox = file.querySelector(SELECTORS.reviewedCheckbox);
            if (checkbox) {
                visibleFilesCount++;
                const lines = getChangesFromFile(file);
                totalLines += lines;

                // Если галочка стоит - строки считаются просмотренными
                if (checkbox.checked) {
                    viewedLines += lines;
                }
            }
        });

        if (visibleFilesCount === 0) return;

        renderProgressBar(viewedLines, totalLines);
    }

    // --- ОТРИСОВКА ---
    function renderProgressBar(viewed, total) {
        const container = document.querySelector(SELECTORS.toolsContainer);
        if (!container) return;

        let myWrapper = document.getElementById(MY_ID);

        // Если элемента еще нет - создаем его по образу и подобию GitHub
        if (!myWrapper) {
            myWrapper = document.createElement('span');
            myWrapper.id = MY_ID;
            // Классы копируем с оригинального элемента diffbar-item
            // hide-md hide-sm скрывают на мобильных, mr-3 дает отступ справа
            myWrapper.className = 'diffbar-item hide-md hide-sm mr-3';
            myWrapper.style.minWidth = '130px'; // Чуть шире, так как цифры могут быть большими

            // Внутренняя структура HTML
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

            // Вставляем В НАЧАЛО контейнера .pr-review-tools
            container.insertBefore(myWrapper, container.firstChild);
        }

        // Обновляем значения
        const countSpan = document.getElementById(`${MY_ID}-count`);
        const barDiv = document.getElementById(`${MY_ID}-bar`);

        if (countSpan && barDiv) {
            const percentage = total === 0 ? 0 : (viewed / total) * 100;

            // Форматируем числа (1 234 вместо 1234) для красоты
            const formattedViewed = new Intl.NumberFormat('en-US').format(viewed);
            const formattedTotal = new Intl.NumberFormat('en-US').format(total);

            const text = `${formattedViewed} / ${formattedTotal}`;

            // Обновляем DOM только если значения изменились
            if (countSpan.textContent !== text) {
                countSpan.textContent = text;
            }

            barDiv.style.width = `${percentage}%`;

            // Опционально: меняем цвет на зеленый, если 100%
            if (percentage >= 100) {
                barDiv.classList.remove('color-bg-accent-emphasis'); // Удаляем синий
                barDiv.classList.add('color-bg-success-emphasis'); // Добавляем зеленый
            } else {
                barDiv.classList.add('color-bg-accent-emphasis');
                barDiv.classList.remove('color-bg-success-emphasis');
            }
        }
    }

    // --- UTIL ---
    function scheduleUpdate() {
        if (debounceTimer) clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            calculateAndDisplay();
        }, 250);
    }

    // --- INIT ---
    function init() {
        scheduleUpdate();

        document.addEventListener('change', (e) => {
            if (e.target.matches(SELECTORS.reviewedCheckbox)) {
                setTimeout(calculateAndDisplay, 50);
            }
        });

        const observer = new MutationObserver((mutations) => {
            let shouldUpdate = false;
            for (let mutation of mutations) {
                // Игнорируем изменения внутри нашего собственного виджета
                if (mutation.target.id === MY_ID ||
                   (mutation.target.closest && mutation.target.closest('#' + MY_ID))) {
                    continue;
                }
                shouldUpdate = true;
            }
            if (shouldUpdate) scheduleUpdate();
        });

        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
    }

    init();

})();
