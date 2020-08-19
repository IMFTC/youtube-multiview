const html = document.querySelector("html");
const body = document.querySelector("body");

// a videoBox contains a YouTube iframe and an overlay used to display
// controls to move videoBoxes inside the videoGrid
const videoBoxes = document.getElementsByClassName("video-box");
// the videoBoxGrid contains all videoBoxes
const videoBoxGrid = document.getElementById("video-box-grid");

// input elements
const urlInput = document.getElementById("url-input");
const urlButton = document.getElementById("url-button");
const sizeSelect = document.getElementById("size-select");
const editButton = document.getElementById("edit-button");
const sizeSelectValues = ["all", "1x1", "2x2", "3x3", "4x4"];

let navigator = null;

// maps n = 0, 1, ... to the n-th videoBox
const videoBoxOrder = {};

let debug = false;

function fillSizeSelect() {
    sizeSelectValues.forEach(value => {
        let option = document.createElement("option");
        option.value = value;
        option.innerHTML = value;
        sizeSelect.appendChild(option);
    });
}

function extractYouTubeID(url){
    url = url.split(/(vi\/|v=|\/v\/|youtu\.be\/|\/embed\/)/);
    return url.length > 1 ? url[2].split(/[^0-9a-z_\-]/i)[0] : url[0];
}

//  Takes a string with youtube URLs or video IDs separated by comma or
//  whitespace and returns an array containing only the video IDs.
function extractVideoIDs(string) {
    let videoIDs = [];
    // replace any whitespace sequence to one ','
    let ids = string.replace(/\s+/, ',').split(',');
    return ids.map(extractYouTubeID)
}

function processURL() {
    let params = new URLSearchParams(document.location.search.substring(1));
    // v is a comma separated list of YouTube video IDs
    debug = params.has("debug");
    console.debug("Debugging mode is " + (debug ? "on" : "off"));

    // handle video ids
    let v = params.get("v");
    if (v) {
        let videoIDs = extractVideoIDs(v);
        console.debug("Loading videos for videoIDs: " + videoIDs);
        appendVideoBoxesforIds(videoIDs);
        console.log("processUrlInput, videoBoxOrder:", videoBoxOrder);
    }

    // Handle dim (number of videos on screen will be dim×dim),
    // defaults to the first option
    let dim = params.get("dim");
    if (dim) {
        console.debug("Handling URL parameter dim=\"" + dim + "\"");
        if (sizeSelectValues.indexOf(dim) < 0) {
            console.error("Invalid value for dim parameter: " + dim
                          + ". Must be one of " + sizeSelectValues);
        } else {
            sizeSelect.value = dim;
        }
    }
}

function appendVideoBoxesforIds(idList) {
    let edit = editButton.innerHTML != "Edit";

    newVideoBoxes = idList.map((id, i) => {
        let videoBox = createVideoBox(id);
        videoBox.style.order = videoBoxes.length + i;
        videoBoxOrder[videoBoxes.length + i] = videoBox;
        // set visibility to get events from the overlay
        videoBox.querySelector(".video-box-overlay")
            .style.visibility = edit ? "visible" : "hidden";
        return videoBox;
    });

    videoBoxGrid.append(...newVideoBoxes);

    // "all" may require a new layout
    if (sizeSelect.value == "all") {
        updateGridColAndRows();
    }
}

function createVideoBox(id) {
    let videoBox = document.createElement("div");
    videoBox.className = "video-box";

    let iframe = createIframeForYouTubeID(id);
    let overlay = createOverlayForYouTubeID(id);
    videoBox.appendChild(iframe);
    videoBox.appendChild(overlay);

    overlay.onmousemove = (mousemove) => {
        if (navigator.parentNode !== overlay) {
            moveNavigator(videoBox);
        }
    }

    return videoBox;
}

function createIframeForYouTubeID(id) {
    let iframe = document.createElement("iframe");
    iframe.id = id;

    if (debug) {
        iframe.style.background = "skyblue";
        iframe.srcdoc = "<div style='display: flex;\
            justify-content: center; align-items: stretch;\
            flex-direction: row; border-style: solid; border-radius: 5px; border-width: 2px;\
            border-XScolor: black;'><h1>" + id + "</h1></div>";
    } else {
        iframe.src="https://www.youtube.com/embed/" + id;
    }

    iframe.frameborder = "0";
    iframe.allow="accelerometer; autoplay; encrypted-media; "
        + "gyroscope; picture-in-picture; fullscreen";

    // this works for firefox, not tested with other browsers
    iframe.allowFullscreen = true;

    return iframe;
}

function createOverlayForYouTubeID(id) {
    let overlay = document.createElement("div");
    overlay.className = "video-box-overlay";
    // overlay.innerHTML = id;

    let deleteButton = document.createElement("button");
    deleteButton.innerHTML = "Remove";
    deleteButton.className = "delete-button";
    deleteButton.onclick = (_) => {
        deleteVideoBox(overlay.parentNode);
    };

    overlay.appendChild(deleteButton);

    return overlay;
}

function deleteVideoBox(videoBox) {
    let n = Number(videoBox.style.order);
    console.debug("Deleting videoBox number " + n);
    for (let i = n; i < videoBoxes.length - 1; i++) {
        videoBoxOrder[i] = videoBoxOrder[i + 1];
        videoBoxOrder[i].style.order = i;
    }

    delete videoBoxOrder[videoBoxes.length];
    videoBoxGrid.removeChild(videoBox);

    if (sizeSelect.value == "all") {
        updateGridColAndRows();
    }
    if (videoBoxes.length > 0) {
        moveNavigator(videoBoxOrder[n]);
    }
    console.debug("New videoBoxOrder: ", videoBoxOrder);
}

function moveNavigator(videoBox) {
    let overlay = videoBox.children[1]

    if (navigator.parentNode != overlay) {
        overlay.appendChild(navigator);
    }

    while (navigator.firstChild) {
        navigator.removeChild(navigator.firstChild);
    }

    let thisIndex = Number(videoBox.style.order);

    for (let i = 0; i < videoBoxes.length; i++) {
        let button = document.createElement("button");
        button.type = "button";
        button.classList.add("navigator-thumb");
        if (i == videoBox.style.order) {
            // the button that corresponds to the videoBox in which
            // the navigator currently is
            button.classList.add("current");
        } else {
            let swapOverlay = videoBoxOrder[i].querySelector(".video-box-overlay");
            button.onclick = _ => {
                swapOverlay.classList.remove("highlight");
                swapGridElementOrders(videoBoxGrid, thisIndex, i);
                // make the navigator stay in place
                moveNavigator(videoBox);
            }
            button.onmouseenter = (_) => {
                swapOverlay.classList.add("highlight");
            }
            button.onmouseleave = (_) => {
                swapOverlay.classList.remove("highlight");
            }
        }
        navigator.appendChild(button);
    }
}

// swap two css 'order' attribute values
function swapGridElementOrders(grid, order1, order2) {
    if (typeof(order1) != "number" || typeof(order2) != "number") {
        console.error("swapGridElementOrders arguments order1, order1 must be numbers");
    }
    console.debug("Swapping videoBoxes: " + order1 + " with " + order2);
    if (order1 == order2) {
        return;
    }

    let videoBox1 = videoBoxOrder[order1];
    let videoBox2 = videoBoxOrder[order2];

    if (videoBox1 && videoBox2) {
        videoBox1.style.order = order2;
        videoBox2.style.order = order1;

        videoBoxOrder[order1] = videoBox2;
        videoBoxOrder[order2] = videoBox1;
    }
}

function removeAllVideoBoxes() {
    while (videoBoxGrid.firstChild) {
        videoBoxGrid.removeChild(videoBoxGrid.firstChild)
    }
}

function processUrlInput() {
    if (!urlInput.value) {
        return;
    }

    let idList = extractVideoIDs(urlInput.value);
    appendVideoBoxesforIds(idList);

    urlInput.value = "";
    updateGrid();
}

function toggleEditMode() {
    let edit = editButton.innerHTML == "Edit";
    editButton.innerHTML = edit ? "Done" : "Edit";

    if (edit && videoBoxes.length > 0) {
        moveNavigator(videoBoxes[0]);
    }

    for (let videoBox of videoBoxes) {
        videoBox.children[1].style.visibility = edit ? "visible" : "hidden";
    }

    navigator.style.visibility = edit ? "visible" : "hidden";
    editButton.style.background = edit ? "orange" : "skyblue";
}

// Update grid to have n rows and n columns
function updateGridColAndRows() {
    let nVideoBoxes = videoBoxGrid.children.length;
    let nCols = (sizeSelect.value == "all" ?
                 Math.ceil(Math.sqrt(nVideoBoxes)) :
                 sizeSelect.value[0]);
    // ensure enough rows to fill the entire screen
    let nRows = Math.max(Math.ceil(nVideoBoxes / nCols), nCols);

    [videoBoxGrid, navigator].forEach((gridElement) => {
        gridElement.style["grid-template-columns"] = "repeat(" + nCols + ", 1fr)";
        gridElement.style["grid-template-rows"] = "repeat(" + nRows + ", 1fr)";
    })

    console.debug("updateGridColAndRows: Setting dimension to " + nRows + "x" + nCols + ".");
}

// Adjust the height of the main box so that the selected number
// of rows fit on the screen.
function updateGridHeight() {
    let gridWidth = html.clientWidth;
    let screenHeight = html.clientHeight;
    let nVideoBoxes = videoBoxGrid.children.length;
    let nRowsOnScreen = (sizeSelect.value == "all" ?
                         Math.ceil(Math.sqrt(nVideoBoxes)) :
                         sizeSelect.value[0]);
    let nTotalRows = Math.ceil(nVideoBoxes / nRowsOnScreen);
    let rowHeight = Math.floor(screenHeight / nRowsOnScreen);
    let rowWidth = Math.floor(gridWidth / nRowsOnScreen);
    // Ensure the box's height fits all videoBoxes, but at least
    // enough rows (can be empty) to fill the entire screen.
    let newBoxHeight = rowHeight * Math.max(nTotalRows, nRowsOnScreen);

    videoBoxGrid.style.height = newBoxHeight + "px";
    console.debug("New videoBoxGrid height: " + newBoxHeight);

    // Change navigator width (or height) to half of the rowWidth
    // (or rowHeight) to always fit the navigator inside the
    // overlay.
    let dim = {width: null, height: null};
    let sizeFactor = 1/3;
    if  (rowWidth / rowHeight < gridWidth / newBoxHeight) {
        // height for width
        dim.width = Math.floor(rowWidth * sizeFactor);
        // dim.height:dim.widht = newBoxHeight:gridWidth
        dim.height = dim.width / gridWidth * newBoxHeight;
    } else {
        // width for height
        dim.height = Math.floor(rowHeight * sizeFactor);
        // dim.height:dim.widht = newBoxHeight:gridWidth
        dim.width = dim.height / newBoxHeight * gridWidth;
    }

    navigator.style.width = dim.width + "px";
    navigator.style.height = dim.height + "px";
}

function updateGrid() {
    updateGridColAndRows();
    updateGridHeight();
}

// connect functions
urlButton.onclick = processUrlInput;
urlInput.addEventListener('keydown', (e) => {
    if (e.key == "Enter") {
        processUrlInput();
    }
})

window.onresize = (e) => {
    updateGrid();
}

window.onload = function() {
    navigator = document.createElement("div");
    navigator.className = "navigator";

    fillSizeSelect();
    sizeSelect.onchange = updateGrid;

    editButton.style.width = Math.max("Edit".length, "Done".length) + 1 + "em";
    editButton.onclick = toggleEditMode;

    processURL();
    updateGrid()
}
