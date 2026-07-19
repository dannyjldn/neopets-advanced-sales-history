// ==UserScript==
// @name         Neopets Advanced Sales History
// @namespace    https://tampermonkey.net/
// @version      3.0.2
// @description  Advanced sales history for Neopets
// @author       Danny
// @match        https://www.neopets.com/market.phtml?type=sales
// @grant        none
// ==/UserScript==

(() => {
    "use strict";

    window.addEventListener("load", init);

    function init() {
        const container = document.querySelector(".mkt-page");
        if (!container) return;

        const table = container.querySelector("table");
        if (!table) return;

        const tbody = table.tBodies[0];

        const rows = [...tbody.rows];

        if (rows.length < 3) return;

        const footer = rows.pop().cloneNode(true);
        rows.shift(); // remove header

        //--------------------------------------------------
        // Styling variables
        //--------------------------------------------------

        const styling = {
            width: "100%",
            tableHeader: {
                backgroundColor: "#dddd77",
                hoverBackgroundColor: "#ecec99",
                sortIcon: "⇅",
                sortAscendingIcon: "▲",
                sortDescendingIcon: "▼",
            },
            items: {
                rowBackgroundColor1: "#ffffcc",
                rowBackgroundColor2: "#ffffff",
            },
        };

        //--------------------------------------------------
        // Blend with Neopets styling
        //--------------------------------------------------

        table.style.width = styling.width;
        table.style.maxWidth = "100%";
        table.style.margin = "0 auto";
        table.style.borderCollapse = "separate";

        //--------------------------------------------------
        // State
        //--------------------------------------------------

        const state = {
            mode: "individual",
            search: "",
            sort: {
                column: "date",
                asc: false,
            },
        };

        //--------------------------------------------------
        // Read original sales
        //--------------------------------------------------

        const sales = rows.map((row) => ({
            date: row.cells[0].innerText.trim(),
            item: row.cells[1].innerText.trim(),
            buyer: row.cells[2].innerText.trim(),
            price: parsePrice(row.cells[3].innerText),
        }));

        //--------------------------------------------------
        // Toolbar
        //--------------------------------------------------

        const toolbar = document.createElement("div");

        toolbar.style.display = "flex";
        toolbar.style.width = styling.width;
        toolbar.style.justifyContent = "space-between";
        toolbar.style.alignItems = "center";
        toolbar.style.margin = "40px auto 10px auto";
        toolbar.style.gap = "10px";

        const left = document.createElement("div");
        const right = document.createElement("div");

        left.style.display = right.style.display = "flex";
        left.style.gap = right.style.gap = "8px";
        right.style.alignSelf = "end";

        toolbar.append(left, right);

        table.before(toolbar);

        //--------------------------------------------------
        // Search
        //--------------------------------------------------

        const search = document.createElement("input");

        search.placeholder = "Search...";
        search.style.padding = "5px 8px";
        search.style.width = "180px";

        search.addEventListener("input", () => {
            state.search = search.value.toLowerCase();
            render();
        });

        //--------------------------------------------------
        // Buttons
        //--------------------------------------------------

        function button(label, fn) {
            const b = document.createElement("button");

            b.textContent = label;
            b.style.cursor = "pointer";
            b.style.padding = "5px 12px";

            b.addEventListener("click", fn);

            return b;
        }

        const groupBtn = button("📦 Group Items", () => {
            const wasGrouped = state.mode === "grouped";

            state.mode = wasGrouped ? "individual" : "grouped";

            // Reset sort if we're switching modes
            if (state.mode === "individual") {
                state.sort = {
                    column: "date",
                    asc: false,
                };
            } else {
                state.sort = {
                    column: "item",
                    asc: true,
                };
            }

            groupBtn.textContent =
                state.mode === "individual"
                    ? "📦 Group Items"
                    : "📋 Individual Items";

            render();
        });

        const restoreBtn = button("🔄 Restore", () => {
            state.mode = "individual";

            state.search = "";

            search.value = "";

            state.sort = {
                column: "date",
                asc: false,
            };

            groupBtn.textContent = "📦 Group Items";

            render();
        });

        left.append(search, groupBtn, restoreBtn);

        //--------------------------------------------------
        // Stats
        //--------------------------------------------------

        const stats = document.createElement("div");

        right.append(stats);

        //--------------------------------------------------
        // Helpers
        //--------------------------------------------------

        function parsePrice(text) {
            return Number(text.replace(/[^\d]/g, ""));
        }

        function format(num) {
            return num.toLocaleString() + " NP";
        }

        function parseDate(text) {
            const [d, m, y] = text.split("/");

            return new Date(y, m - 1, d).getTime();
        }

        function rowBackground(index) {
            return index % 2 === 0
                ? styling.items.rowBackgroundColor1
                : styling.items.rowBackgroundColor2;
        }

        //--------------------------------------------------
        // Sorting
        //--------------------------------------------------

        function sortData(data) {
            const key = state.sort.column;

            return [...data].sort((a, b) => {
                let x = a[key] ?? "";
                let y = b[key] ?? "";

                if (key === "price") {
                    // numbers
                } else if (key === "date") {
                    x = parseDate(x);
                    y = parseDate(y);
                } else {
                    x = x.toLowerCase();
                    y = y.toLowerCase();
                }

                if (x < y) return state.sort.asc ? -1 : 1;
                if (x > y) return state.sort.asc ? 1 : -1;

                return 0;
            });
        }

        //--------------------------------------------------
        // Group sales
        //--------------------------------------------------

        function groupedSales(data) {
            const map = {};

            data.forEach((s) => {
                if (!map[s.item]) {
                    map[s.item] = {
                        item: s.item,
                        qty: 0,
                        lowest: s.price,
                        highest: s.price,
                        total: 0,
                    };
                }

                const g = map[s.item];

                g.qty++;
                g.total += s.price;
                g.lowest = Math.min(g.lowest, s.price);
                g.highest = Math.max(g.highest, s.price);
            });

            return Object.values(map).map((g) => ({
                ...g,

                average: Math.round(g.total / g.qty),
            }));
        }

        //--------------------------------------------------
        // Render
        //--------------------------------------------------

        function render() {
            let data = [...sales];

            if (state.search) {
                data = data.filter(
                    (s) =>
                        s.item.toLowerCase().includes(state.search) ||
                        s.buyer.toLowerCase().includes(state.search),
                );
            }

            tbody.innerHTML = "";

            if (state.mode === "individual") {
                data = sortData(data);

                buildHeader([
                    ["date", "Date"],
                    ["item", "Item"],
                    ["buyer", "Buyer"],
                    ["price", "Price"],
                ]);

                data.forEach((s, index) => {
                    const bg = rowBackground(index);

                    const tr = document.createElement("tr");

                    tr.innerHTML = `
                        <td bgcolor="${bg}" align="center">${s.date}</td>
                        <td bgcolor="${bg}">${s.item}</td>
                        <td bgcolor="${bg}" align="center"><a href="https://www.neopets.com/browseshop.phtml?owner=${s.buyer}" target="_blank">${s.buyer}</a></td>
                        <td bgcolor="${bg}" align="center">${format(s.price)}</td>
                    `;

                    tbody.appendChild(tr);
                });
            } else {
                let grouped = groupedSales(data);

                grouped.sort((a, b) => {
                    let x = a[state.sort.column] ?? a.item;
                    let y = b[state.sort.column] ?? b.item;

                    if (typeof x === "string") {
                        x = x.toLowerCase();
                        y = y.toLowerCase();
                    }

                    if (x < y) return state.sort.asc ? -1 : 1;
                    if (x > y) return state.sort.asc ? 1 : -1;

                    return 0;
                });

                buildHeader([
                    ["item", "Item"],
                    ["qty", "Qty"],
                    ["lowest", "Lowest"],
                    ["average", "Average"],
                    ["highest", "Highest"],
                    ["total", "Total"],
                ]);

                grouped.forEach((g, index) => {
                    const bg = rowBackground(index);

                    const tr = document.createElement("tr");

                    tr.innerHTML = `
                        <td bgcolor="${bg}">${g.item}</td>
                        <td bgcolor="${bg}" align="center">${g.qty}</td>
                        <td bgcolor="${bg}" align="center">${format(g.lowest)}</td>
                        <td bgcolor="${bg}" align="center">${format(g.average)}</td>
                        <td bgcolor="${bg}" align="center">${format(g.highest)}</td>
                        <td bgcolor="${bg}" align="center">${format(g.total)}</td>
                    `;

                    tbody.appendChild(tr);
                });
            }

            const footerClone = footer.cloneNode(true);

            const footerCell = footerClone.querySelector("td[colspan]");
            if (footerCell) {
                footerCell.colSpan = tbody.rows[0].cells.length;
            }

            tbody.appendChild(footerClone);

            updateStats(data);
        }

        //--------------------------------------------------
        // Header
        //--------------------------------------------------

        function buildHeader(columns) {
            const tr = document.createElement("tr");

            const sortable = new Set(columns.map(([key]) => key));

            columns.forEach(([key, label]) => {
                const td = document.createElement("td");

                td.bgColor = styling.tableHeader.backgroundColor;
                td.align = "center";
                td.style.userSelect = "none";

                if (sortable.has(key)) {
                    td.style.cursor = "pointer";
                    td.style.fontSize = "11pt";
                    td.style.transition = "background .15s";

                    td.onmouseenter = () =>
                        (td.bgColor = styling.tableHeader.hoverBackgroundColor);
                    td.onmouseleave = () =>
                        (td.bgColor = styling.tableHeader.backgroundColor);

                    let icon = ` ${styling.tableHeader.sortIcon}`;

                    if (state.sort.column === key) {
                        icon = state.sort.asc
                            ? ` ${styling.tableHeader.sortAscendingIcon}`
                            : ` ${styling.tableHeader.sortDescendingIcon}`;
                    }

                    td.innerHTML = `<b>${label}${icon}</b>`;

                    td.onclick = () => {
                        if (state.sort.column === key) {
                            state.sort.asc = !state.sort.asc;
                        } else {
                            state.sort.column = key;
                            state.sort.asc = true;
                        }

                        render();
                    };
                } else {
                    td.innerHTML = `<b>${label}</b>`;
                }

                tr.appendChild(td);
            });

            tbody.appendChild(tr);
        }
        //--------------------------------------------------
        // Stats
        //--------------------------------------------------

        function updateStats(data) {
            const total = data.reduce(
                (sum, s) => sum + (s.total ?? s.price),
                0,
            );

            stats.innerHTML = `
                <b>${
                    state.mode === "grouped"
                        ? data.length + " unique items"
                        : data.length + " sales"
                }</b>
                &nbsp; | &nbsp;
                <b>${format(total)}</b>
            `;
        }

        //--------------------------------------------------
        // Initial render
        //--------------------------------------------------

        render();
    }
})();
