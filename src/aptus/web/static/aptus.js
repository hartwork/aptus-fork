// Aptus web

const tileX = 400;

let centerr, centeri;
let pixsize;
let angle;
let continuous;
let iter_limit;
let palette_index;

let canvasW, canvasH;
let fractal_canvas, overlay_canvas;
let fractal_ctx, overlay_ctx;
let help_panel;
let move_target = null;
let moving;

// sin(angle) and cos(angle)
let sina, cosa;

// Request sequence number. Requests include the sequence number and the tile
// returns it. If the sequence number has been incremented since the tile was
// requested, then the tile is no longer needed, and is not displayed.
let reqseq = 0;

function reset() {
    centerr = -0.6;
    centeri = 0.0;
    pixsize = 3.0/600;
    set_angle(0.0);
    continuous = false;
    iter_limit = 999;
    palette_index = 0;
}

function fetchTile(tile) {
    return new Promise(resolve => {
        const body = {
            seq: tile.reqseq,
            spec: tile.spec,
        };
        fetch("/tile", {method: "POST", body: JSON.stringify(body)})
        .then(response => response.json())
        .then(tiledata => {
            if (tiledata.seq == reqseq) {
                const img = new Image();
                tile.img = img;
                img.src = tiledata.url;
                img.onload = () => resolve(tile);
            }
            else {
                // console.log("Discarding tile with seq " + tiledata.seq + ", only interested now in " + reqseq);
            }
        });
    });
}

function showTile(tile) {
    tile.ctx.drawImage(tile.img, tile.tx*tileX, tile.ty*tileX);
}

function getImage(tile) {
    return fetchTile(tile).then(showTile);
}

function paint() {
    reqseq += 1;
    const imageurls = [];
    for (let tx = 0; tx < canvasW / tileX; tx++) {
        for (let ty = 0; ty < canvasH / tileX; ty++) {
            spec = {
                center: [centerr, centeri],
                diam: [canvasW * pixsize, canvasH * pixsize],
                size: [canvasW, canvasH],
                coords: [tx*tileX, (tx+1)*tileX, ty*tileX, (ty+1)*tileX],
                angle: angle,
                continuous: continuous,
                iter_limit: iter_limit,
                palette: palettes[palette_index],
            }
            imageurls.push({ctx: fractal_ctx, tx, ty, spec, reqseq});
        }
    }
    return Promise.all(imageurls.map(getImage));
}

function clear_ctx(ctx) {
    ctx.clearRect(0, 0, canvasW, canvasH);
}

function getCursorPosition(ev, target) {
    const rect = target.getBoundingClientRect()
    const x = ev.clientX - rect.left
    const y = ev.clientY - rect.top
    return {x, y};
}

function ri4xy(x, y) {
    const r0 = centerr - (canvasW * cosa + canvasH * sina)/2 * pixsize;
    const i0 = centeri + (canvasH * cosa - canvasW * sina)/2 * pixsize;
    const r = r0 + (x * cosa + y * sina) * pixsize;
    const i = i0 - (y * cosa - x * sina) * pixsize;
    return {r, i};
}

function mainpane_mousedown(ev) {
    ev.preventDefault();
    move_target = ev.target.closest(".mainpane")
    document.addEventListener("mouseup", mainpane_mouseup);
    rubstart = getCursorPosition(ev, move_target);
}

function mousemove(ev) {
    ev.preventDefault();
    if (move_target !== null) {
        const movedto = getCursorPosition(ev, move_target);
        clear_ctx(overlay_ctx);
        if (moving) {
            fractal_canvas.style.left = (movedto.x - rubstart.x) + "px";
            fractal_canvas.style.top = (movedto.y - rubstart.y) + "px";
        }
        else {
            overlay_ctx.lineWidth = 1;
            overlay_ctx.strokeStyle = "white";
            overlay_ctx.strokeRect(rubstart.x, rubstart.y, movedto.x - rubstart.x, movedto.y - rubstart.y);
        }
    }
}

function mainpane_mouseup(ev) {
    ev.preventDefault();
    const up = getCursorPosition(ev, move_target);
    const dx = up.x - rubstart.x;
    const dy = up.y - rubstart.y;
    if (moving) {
        centerr -= (cosa * dx + sina * dy) * pixsize;
        centeri += (cosa * dy - sina * dx) * pixsize;
        overlay_ctx.drawImage(fractal_canvas, dx, dy);
        fractal_canvas.style.left = "0";
        fractal_canvas.style.top = "0";
        fractal_ctx.fillStyle = "white";
        fractal_ctx.fillRect(0, 0, canvasW, canvasH);
        paint().then(() => {
            clear_ctx(overlay_ctx);
        });
    }
    else {
        clear_ctx(overlay_ctx);
        const moved = Math.abs(dx) + Math.abs(dy);
        if (moved > 20) {
            const {r: ra, i: ia} = ri4xy(rubstart.x, rubstart.y);
            const {r: rb, i: ib} = ri4xy(up.x, up.y);
            centerr = (ra + rb) / 2;
            centeri = (ia + ib) / 2;
            pixsize = Math.max(Math.abs(ra - rb) / canvasW, Math.abs(ia - ib) / canvasH);
        }
        else {
            const {r: clickr, i: clicki} = ri4xy(up.x, up.y);

            if (ev.shiftKey) {
                pixsize *= (ev.ctrlKey ? 1.1 : 2.0);
            }
            else {
                pixsize /= (ev.ctrlKey ? 1.1 : 2.0);
            }
            const r0 = clickr - (up.x * cosa + up.y * sina) * pixsize;
            const i0 = clicki + (up.y * cosa - up.x * sina) * pixsize;
            centerr = r0 + (canvasW * cosa + canvasH * sina)/2 * pixsize;
            centeri = i0 - (canvasH * cosa - canvasW * sina)/2 * pixsize;
        }
        paint();
    }
    document.removeEventListener("mouseup", mainpane_mouseup);
    move_target = null;
}

function keydown(ev) {
    var handled = false;

    //console.log("key:",  ev.key, "shift:", ev.shiftKey, "ctrl:", ev.ctrlKey, "meta:", ev.metaKey, "alt:", ev.altKey);
    var key = ev.key;

    // Chrome handles ctrl-lessthan as shift-ctrl-comma. Fix those combinations
    // to be what we expect.
    if (ev.shiftKey) {
        switch (key) {
            case ".":
                key = ">";
                break;
            case ",":
                key = "<";
                break;
        }
    }

    if (!ev.metaKey && !ev.altKey) {
        handled = true;
        switch (key) {
            case "a":
                new_angle = +prompt("Angle", angle);
                if (new_angle != angle) {
                    set_angle(new_angle);
                    paint();
                }
                break;

            case "c":
                continuous = !continuous;
                paint();
                break;

            case "i":
                new_limit = +prompt("Iteration limit", iter_limit);
                if (new_limit != iter_limit) {
                    iter_limit = new_limit;
                    paint();
                }
                break;

            case "m":
                moving = !moving;
                if (moving) {
                    overlay_canvas.classList.add("move");
                }
                else {
                    overlay_canvas.classList.remove("move");
                }
                break;

            case "r":
                paint();
                break;

            case "R":
                reset();
                paint();
                break;

            case ",":
                palette_index -= 1;
                if (palette_index < 0) {
                    palette_index += palettes.length;
                }
                paint();
                break;

            case ".":
                palette_index += 1;
                palette_index %= palettes.length;
                paint();
                break;

            case ">":
                set_angle(angle + (ev.ctrlKey ? 1 : 10));
                paint();
                break;

            case "<":
                set_angle(angle - (ev.ctrlKey ? 1 : 10));
                paint();
                break;

            case "?":
                if (help_panel.style.display === "block") {
                    help_panel.style.display = "none";
                }
                else {
                    help_panel.style.top = "5em";
                    help_panel.style.right = "5em";
                    help_panel.style.left = help_panel.style.bottom = null;
                    help_panel.style.display = "block";
                }
                break;

            default:
                handled = false;
                break;
        }
    }

    if (handled) {
        ev.preventDefault();
    }
}

function set_size() {
    canvasW = fractal_canvas.width = overlay_canvas.width = window.innerWidth;
    canvasH = fractal_canvas.height = overlay_canvas.height = window.innerHeight;
}

function set_angle(a) {
    angle = (a % 360 + 360) % 360;
    const rads = angle / 180 * Math.PI;
    sina = Math.sin(rads)
    cosa = Math.cos(rads)
}

let resize_timeout = null;

function resize() {
    if (resize_timeout) {
        clearTimeout(resize_timeout);
    }
    resize_timeout = setTimeout(
        () => {
            resize_timeout = null;
            set_size();
            paint();
        },
        250
    );
}

var draggable = null;
var draggable_start;

function draggable_mousedown(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    rubstart = {x: ev.clientX, y: ev.clientY};
    draggable = ev.target.closest(".draggable");
    draggable_start = {x: draggable.offsetLeft, y: draggable.offsetTop};
    draggable.style.left = draggable.offsetLeft + "px";
    draggable.style.top = draggable.offsetTop + "px";
    draggable.style.right = null;
    draggable.style.bottom = null;
    document.addEventListener("mousemove", draggable_mousemove);
    document.addEventListener("mouseup", draggable_mouseup);
}

function draggable_mousemove(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    const movedto = {x: ev.clientX, y: ev.clientY};
    draggable.style.left = draggable_start.x - (rubstart.x - movedto.x) + "px";
    draggable.style.top = draggable_start.y - (rubstart.y - movedto.y) + "px";
}

function draggable_mouseup(ev) {
    ev.preventDefault();
    ev.stopPropagation();
    document.removeEventListener("mousemove", draggable_mousemove);
    document.removeEventListener("mouseup", draggable_mouseup);
    draggable = null;
}

document.body.onload = () => {
    fractal_canvas = document.getElementById("fractal");
    overlay_canvas = document.getElementById("overlay");

    fractal_ctx = fractal_canvas.getContext("2d");
    overlay_ctx = overlay_canvas.getContext("2d");

    help_panel = document.getElementById("helppanel");
    help_panel.addEventListener("mousedown", draggable_mousedown);

    moving = false;

    overlay_canvas.addEventListener("mousedown", mainpane_mousedown);
    document.addEventListener("mousemove", mousemove);
    document.addEventListener("contextmenu", ev => { ev.preventDefault(); return false; });
    document.addEventListener("keydown", keydown);
    window.addEventListener("resize", resize);

    set_size();
    reset();
    paint();
}
