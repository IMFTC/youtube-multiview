const html = document.getElementsByTagName("html")[0];
const body = document.getElementsByTagName("body")[0];

// elements containing the iframes
const mainContainer = document.getElementById("main-container");
const videoStacks = document.getElementsByClassName("video-stack")

// input elements
const urlInput = document.getElementById("url-input");
const urlButton = document.getElementById("url-button");
const sizeSelect = document.getElementById("size-select");
const editButton = document.getElementById("edit-button");
let positionSelector = null;

// maps n = 0, 1, ... to the n-th videoStack
const videoStackOrder = {};

let nVideosOnScreen = 1;
let debug = true;

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
    let v = params.get("v");

    if (!v) {
        return;
    }

    let videoIDs = extractVideoIDs(v);
    console.debug("Loading videoStacks for videoIDs: " + videoIDs);
    appendVideoStacksforIds(videoIDs);
}

function appendVideoStacksforIds(idList) {
    let edit = editButton.innerHTML != "Edit";

    newVideoStacks = idList.map((id, i) => {
        let videoStack = createVideoStack(id);
        videoStack.style.order = videoStacks.length + i;
        videoStackOrder[videoStacks.length + i] = videoStack;
        // set visibility to get events from the overlay
        videoStack.querySelector(".video-overlay").style.visibility = edit ? "visible" : "hidden";
        return videoStack;
    });

    mainContainer.append(...newVideoStacks);

    // "fitall" may require a new layout
    if (sizeSelect.value == "fitall") {
        updateGridColAndRows();
    }
}

function createVideoStack(id) {
    let videoStack = document.createElement("div");
    videoStack.className = "video-stack";

    let iframe = createIframeForYouTubeID(id);
    let overlay = createOverlayForYouTubeID(id);
    videoStack.appendChild(iframe);
    videoStack.appendChild(overlay);

    overlay.onmousemove = (mousemove) => {
        if (positionSelector.parentNode !== overlay) {
            moveVideoSelector(videoStack);
        }
    }

    return videoStack;
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
    overlay.className = "video-overlay";
    // overlay.innerHTML = id;

    return overlay;
}

function moveVideoSelector(videoStack) {
    let activeVideoStack = videoStack;
    let overlay = videoStack.children[1]

    if (positionSelector.parentNode != overlay) {
        overlay.appendChild(positionSelector);
    }

    while (positionSelector.firstChild) {
        positionSelector.removeChild(positionSelector.firstChild)
    }

    for (let i = 0; i < videoStacks.length; i++) {
        let button = document.createElement("button");
        button.type = "button";
        button.className = (i != activeVideoStack.style.order
                            ? "video-selector-thumb"
                            : "video-selector-thumb-current");
        let iSwap = Number(activeVideoStack.style.order);
        button.onclick = (click) => {
            swapGridElementOrders(mainContainer, iSwap, i);
            moveVideoSelector(videoStack);
        }
        positionSelector.appendChild(button);
    }
}

// swap two css 'order' attribute values
function swapGridElementOrders(grid, order1, order2) {
    if (typeof(order1) != "number" || typeof(order2) != "number") {
        console.error("swapGridElementOrders arguments order1, order1 must be numbers");
    }
    console.debug("Swapping videoStacks: " + order1 + " with " + order2);
    if (order1 == order2) {
        return;
    }

    let videoStack1 = videoStackOrder[order1];
    let videoStack2 = videoStackOrder[order2];

    if (videoStack1 && videoStack2) {
        videoStack1.style.order = order2;
        videoStack2.style.order = order1;

        videoStackOrder[order1] = videoStack2;
        videoStackOrder[order2] = videoStack1;
    }
}

function removeAllVideoStacks() {
    while (mainContainer.firstChild) {
        mainContainer.removeChild(mainContainer.firstChild)
    }
}

function processUrlInput() {
    if (!urlInput.value) {
        return;
    }

    let idList = extractVideoIDs(urlInput.value);
    appendVideoStacksforIds(idList);

    urlInput.value = "";
    updateGrid();
}

function toggleEditMode() {
    let edit = editButton.innerHTML == "Edit";
    editButton.innerHTML = edit ? "Done" : "Edit";

    if (edit && videoStacks.length > 0) {
        moveVideoSelector(videoStacks[0]);
    }

    for (let videoStack of videoStacks) {
        videoStack.children[1].style.visibility = edit ? "visible" : "hidden";
    }

    positionSelector.style.visibility = edit ? "visible" : "hidden";
    editButton.style.background = edit ? "orange" : "skyblue";
}

// Update grid to have n rows and n columns
function updateGridColAndRows() {
    let nVideoStacks = mainContainer.children.length;
    let nCols = (sizeSelect.value == "fitall" ?
                 Math.ceil(Math.sqrt(nVideoStacks)) :
                 sizeSelect.value[0]);
    // ensure enough rows to fill the entire screen
    let nRows = Math.max(Math.ceil(nVideoStacks / nCols), nCols);

    [mainContainer, positionSelector].forEach((gridElement) => {
        gridElement.style["grid-template-columns"] = "repeat(" + nCols + ", 1fr)";
        gridElement.style["grid-template-rows"] = "repeat(" + nRows + ", 1fr)";
    })

    console.debug("updateGridColAndRows: Setting dimension to " + nRows + "x" + nCols + ".");
}

// Adjust the height of the main container so that the selected number
// of rows fit on the screen.
function updateGridHeight() {
    let gridWidth = html.clientWidth;
    let screenHeight = html.clientHeight;
    let nVideoStacks = mainContainer.children.length;
    let nRowsOnScreen = (sizeSelect.value == "fitall" ?
                         Math.ceil(Math.sqrt(nVideoStacks)) :
                         sizeSelect.value[0]);
    let nTotalRows = Math.ceil(nVideoStacks / nRowsOnScreen);
    let rowHeight = Math.floor(screenHeight / nRowsOnScreen);
    let rowWidth = Math.floor(gridWidth / nRowsOnScreen);
    // Ensure the container's height fits all videos, but at least
    // enough rows (can be empty) to fill the entire screen.
    let newContainerHeight = rowHeight * Math.max(nTotalRows, nRowsOnScreen);

    mainContainer.style.height = newContainerHeight + "px";
    console.debug("New mainContainer height: " + newContainerHeight);

    // Change positionSelector width (or height) to half of the rowWidth
    // (or rowHeight) to always fit the positionSelector inside the
    // overlay.
    let dim = {width: null, height: null};
    let sizeFactor = 1/3;
    if  (rowWidth / rowHeight < gridWidth / newContainerHeight) {
        // height for width
        dim.width = Math.floor(rowWidth * sizeFactor);
        // dim.height:dim.widht = newContainerHeight:gridWidth
        dim.height = dim.width / gridWidth * newContainerHeight;
    } else {
        // width for height
        dim.height = Math.floor(rowHeight * sizeFactor);
        // dim.height:dim.widht = newContainerHeight:gridWidth
        dim.width = dim.height / newContainerHeight * gridWidth;
    }

    positionSelector.style.width = dim.width + "px";
    positionSelector.style.height = dim.height + "px";
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
    positionSelector = document.createElement("div");
    positionSelector.className = "video-selector";

    sizeSelect.value = "fitall";
    sizeSelect.onchange = updateGrid;

    processURL();
    updateGrid()
}

editButton.style.width = Math.max("Edit".length, "Done".length) + 1 + "em";
editButton.onclick = toggleEditMode;
