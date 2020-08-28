const html = document.querySelector("html");
const body = document.querySelector("body");

// The videoBoxGrid contains all videoBoxes.
const videoBoxGrid = document.getElementById("video-box-grid");
// A videoBox contains a YouTube iframe and an overlay used to display
// controls to move videoBoxes inside the videoGrid.
const videoBoxes = document.getElementsByTagName("video-box");

// input elements
const urlInput = document.getElementById("url-input");
const urlButton = document.getElementById("url-button");
const playAllButton = document.getElementById("play-all-button");
const pauseAllButton = document.getElementById("pause-all-button");
const liveAllButton = document.getElementById("live-all-button");
const sizeSelect = document.getElementById("size-select");
const autoplayCheckbox = document.getElementById("autoplay-checkbox");
const editButton = document.getElementById("edit-button");
const sizeSelectValues = ["all", "1x1", "2x2", "3x3", "4x4"];

// The settingsBarTrigger has a fixed position at the bottom of the screen and
// is a few pixels high. It is used to recognize the pointer near the bottom
// of the window which will make the settingsBar show up.
const settingsBarTrigger = document.getElementById("event-overlay");
const settingsBar = document.getElementById("settings");
// Maps n = 0, 1, ... to the n-th videoBox.
const videoBoxOrder = new Map();

// elements produced by code that are not in the .html file
let videoSelector = null;

// URL parameters that need to be accessed globally
let debug = false;
let autoplay = false;

// global timeouts
let hideSettingsBarTimeout = null;

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
    return ids.map(extractYouTubeID);
}

// Resets the page to the settings in the URL.
function processURL() {
    let params = new URLSearchParams(document.location.search.substring(1));
    // v is a comma separated list of YouTube video IDs
    debug = params.has("debug");
    console.debug("Debugging mode is " + (debug ? "on" : "off"));

    // Start playing videos immediatly?
    autoplay = (params.get("autoplay") == "1");
    autoplayCheckbox.checked = autoplay;

    // Handle dim (number of videos on screen will be dim×dim),
    // defaults to the first option.
    let dimValue = params.get("dim");
    if (dimValue) {
        if (sizeSelectValues.indexOf(dimValue) < 0) {
            console.error("Invalid value for dim parameter: " + dimValue
                          + ". Must be one of " + sizeSelectValues);
        } else {
            sizeSelect.value = dimValue;
        }
    }

    // handle all video ids
    let vValue = params.get("v");
    if (vValue) {
        let videoIDs = extractVideoIDs(vValue);
        console.debug("Loading videos for videoIDs: " + videoIDs);
        appendVideoBoxesforIds(videoIDs);
    }

    // add default parameter values to the URL.
    updateUrl();
}

class VideoBox extends HTMLElement {
    constructor(videoid) {
        super();
        this.attachShadow({mode: 'open'});
        this._videoid = videoid;
        this._order = 0;
        this._editMode = false;
        this._highlight = false;

        this.connected = false;
    }

    // // Exposing the videoid as element attribute is overengineering
    // // at this point, but let's keep the code around to remember how it works.
    //
    // static get observedAttributes() { return ["videoid"]; }

    // attributeChangedCallback(name, oldValue, newValue) {
    //     console.log("attributeChangedCallback", name, oldValue, newValue);
    //     if (oldValue == newValue) {
    //         return;
    //     }

    //     switch(name) {
    //     case "videoid":
    //         this._videoid = newValue;
    //         break;
    //     }
    //     this._updateRendering();
    // }

    set editMode(newValue) {
        this._editMode = newValue;
        this._updateRendering();
    }

    get editMode() {
        return this._editMode;
    }

    set videoid(newValue) {
        // this.setAttribute("videoid", newValue);

        // remove the following line if using setAttribute above
        this._videoid = newValue;
    }

    get videoid() {
        return this._videoid;
    }

    set order(newValue) {
        this._order = newValue;
        this._updateRendering();
    }

    get order() {
        return this._order;
    }

    set highlight(newValue) {
        this._highlight = newValue;
        this._updateRendering();
    }

    get highlight() {
        return this._highlight;
    }

    set showDeleteButton(show) {
        this._showDeleteButton = show;
        this._updateRendering();
    }

    get showDeleteButton() {
        return this._showDeleteButton;
    }

    // postMessage methods are not part of the official API,
    // we use them to avoid including YouTube scripts in the main document,
    // see [#0] in the References.
    sendCommandToIframe(command, args) {
        this._iframe.contentWindow.postMessage(JSON.stringify({
            'event': 'command',
            'func': command,
            'args': args || []
        }), '*');
    }

    playVideo() {
        this.sendCommandToIframe('playVideo');
    }

    pauseVideo() {
        this.sendCommandToIframe('pauseVideo');
    }

    showVideoSelector() {
        if (videoSelector.parentNode != this._overlay) {
            this._overlay.appendChild(videoSelector);
        }

        while (videoSelector.firstChild) {
            videoSelector.removeChild(videoSelector.firstChild);
        }

        let thisIndex = this._order;
        for (let i = 0; i < videoBoxes.length; i++) {
            let button = document.createElement("button");
            button.type = "button";
            button.classList.add("video-selector-thumb");
            let ithVideoBox = videoBoxOrder.get(i);

            if (!debug) {
                let id = ithVideoBox.videoid;
                button.style["background-image"] = "url(https://img.youtube.com/vi/"
                    + id + "/sddefault.jpg)";
            }

            if (i == this._order) {
                // the button that corresponds to the videoBox in which
                // the videoSelector currently is
                button.classList.add("current");
            } else {
                button.onclick = (_) => {
                    this.highlight = true;
                    this.showDeleteButton = false;
                    ithVideoBox.highlight = false;
                    ithVideoBox.showDeleteButton = true;
                    swapGridElementOrders(videoBoxGrid, thisIndex, i);
                    // make the videoSelector stay in place
                    videoBoxOrder.get(thisIndex).showVideoSelector();

                    updateUrl();
                }
                button.onmouseenter = (_) => {
                    ithVideoBox.highlight = true;
                }
                button.onmouseleave = (_) => {
                    ithVideoBox.highlight = false;
                }
            }
            videoSelector.appendChild(button);
        }
    }

    _updateRendering() {
        if (!this.connected)
            return;

        // hide or show overlay
        this._overlay.style.visibility = this._editMode ? "visible" : "hidden";

        // hide or show overlay highlight
        if (this._highlight)
            this._overlay.classList.add("highlight");
        else
            this._overlay.classList.remove("highlight");

        // update CSS order property
        if (this.style.order !== this._order) {
            this.style.order = String(this._order);
        }

        // update iframe
        let src="https://www.youtube.com/embed/" + this._videoid
            + "?enablejsapi=1&autoplay=" + (autoplay ? "1" : "0");
        if (src != this._iframe.src)
            this._iframe.src = src;

        // hide or show delete button
        this._deleteButton.style.visibility
            = this._showDeleteButton ? "visible" : "hidden";
    }

    connectedCallback() {
        if (this.connected)
            return;

        let templateContent = document.getElementById('video-box-template').content;
        this.shadowRoot.appendChild(templateContent.cloneNode(true));

        // iframe
        this._iframe = this.shadowRoot.querySelector("iframe");

        // overlay
        this._overlay = this.shadowRoot.querySelector(".video-box-overlay");
        this._overlay.onmousemove = (mousemove) => {
            if (videoSelector.parentNode !== this._overlay) {
                this.showVideoSelector();
            }
        }
        this._overlay.onmouseenter = (mouseenter) => {
            this.showDeleteButton = true;
        }
        this._overlay.onmouseleave = (mouseleave) => {
            this.showDeleteButton = false;
        }

        //  deleteButton is a child of this._overlay
        this._deleteButton = this.shadowRoot.querySelector(".delete-button");
        this._deleteButton.onclick = () => {
            deleteVideoBox(this);
        };

        // update all relevant style properties
        this.connected = true;
        this._updateRendering();

        this.playVideo();
    }
}

customElements.define('video-box', VideoBox);

function appendVideoBoxesforIds(idList) {
    let edit = editButton.classList.contains("depressed");

    let n = videoBoxes.length;
    newVideoBoxes = idList.map(id => {
        let videoBox = new VideoBox(id);
        videoBox.editMode = edit;
        videoBox.order = videoBoxOrder.size;
        videoBoxOrder.set(videoBoxOrder.size, videoBox);
        return videoBox;
    });

    console.debug("newVideoBoxes:", newVideoBoxes);

    videoBoxGrid.append(...newVideoBoxes);

    updateGrid();
}

function deleteVideoBox(videoBox) {
    let n = videoBox.order;
    console.debug("Deleting videoBox number " + n);

    videoBoxGrid.removeChild(videoBox);

    // closing the gap at videoBoxOrder.get(n)
    for (let i = n; i < videoBoxes.length; i++) {
        videoBoxOrder.set(i, videoBoxOrder.get(i + 1));
        videoBoxOrder.get(i).order = i;
    }
    // delete previously highest key
    videoBoxOrder.delete(videoBoxes.length);

    updateGrid();

    // keep the videoSelector in place if the deleted videoBox was
    // replaced by a successor
    if (videoBoxOrder.has(n)) {
        videoBoxOrder.get(n).showVideoSelector();
    }
    console.debug("New videoBoxOrder: ", videoBoxOrder);
    updateUrl();
}

function swapGridElementOrders(grid, order1, order2) {
    if (typeof(order1) != "number" || typeof(order2) != "number") {
        console.error("swapGridElementOrders arguments order1, order1 must be numbers");
    }
    console.debug("Swapping videoBoxes: " + order1 + " with " + order2);
    if (order1 == order2) {
        return;
    }

    let videoBox1 = videoBoxOrder.get(order1);
    let videoBox2 = videoBoxOrder.get(order2);

    if (videoBox1 && videoBox2) {
        videoBox1.order = order2;
        videoBox2.order = order1;
        videoBoxOrder.set(order1, videoBox2);
        videoBoxOrder.set(order2, videoBox1);
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
    updateUrl();
}

function toggleEditMode() {
    let edit = !editButton.classList.contains("depressed");
    // in edit mode we don't want to hide the settingsBar automatically since
    // it contains the Done button
    connectSettingsBarEvents(!edit);

    for (let videoBox of videoBoxes) {
        videoBox.editMode = edit;
    }

    videoSelector.style.visibility = edit ? "visible" : "hidden";
    if (edit)  {
        editButton.classList.add("depressed");
        settingsBar.classList.add("edit");
        showSettingsBar();
        // When the mouse leaves the settingsBar while in edit mode it should
        // not be hidden after scrolling because it contains the Edit Mode
        // button needed to leave edit mode.
        document.removeEventListener("scroll", onScroll);
    } else {
        settingsBar.classList.remove("edit");
        editButton.classList.remove("depressed");
        // see above comment
        document.addEventListener("scroll", onScroll);
    }
}

function sendCommandToAllIframes(command, args) {
    for (let videoBox of videoBoxes)
        videoBox.sendCommandToIframe(command, args);
}

function playAllIframes() {
    sendCommandToAllIframes('playVideo')
}

function liveAllIframes() {
    playAllIframes();
    // Apparently there is no official API for live streams to jump to live
    // playback, but requesting a large enough numbers appears to work.
    // Based on https://developers.google.com/youtube/iframe_api_reference#seekTo
    let seconds = Number.MAX_SAFE_INTEGER;
    let allowSeekAhead = true;
    sendCommandToAllIframes('seekTo', [seconds, allowSeekAhead])
}

function pauseAllIframes() {
    sendCommandToAllIframes('pauseVideo')
}

// Update grid to have n rows and n columns.
function updateGridColAndRows() {
    let nVideoBoxes = videoBoxes.length;
    // dim= "nxn" or "all"
    let n = (sizeSelect.value == "all" ?
             Math.ceil(Math.sqrt(nVideoBoxes)) :
             Number(sizeSelect.value[0]))
    let nCols = Math.max(1, n);

    // Ensure enough rows to fill the entire screen because we don't want the
    // controls or the footer to be visible by default.
    let nRows = Math.max(Math.ceil(nVideoBoxes / nCols), nCols);

    [videoBoxGrid, videoSelector].forEach((grid) => {
        grid.style["grid-template-columns"] = "repeat(" + nCols + ", 1fr)";
        grid.style["grid-template-rows"] = "repeat(" + nRows + ", 1fr)";
    })

    console.debug("updateGridColAndRows: Setting dimension to " + nRows + "x" + nCols + ".");
}

// Adjust the height of the main box so that the selected number
// of rows fit on the screen.
function updateGridHeight() {
    let gridWidth = html.clientWidth;
    let screenHeight = html.clientHeight;
    let nVideoBoxes = videoBoxes.length;

    // no videoBoxes
    if (nVideoBoxes == 0) {
        videoBoxGrid.style.height = "0px";

        return;
    }

    // at least one videoBox
    let nRowsOnScreen = (sizeSelect.value == "all" ?
                         Math.ceil(Math.sqrt(nVideoBoxes)) :
                         Number(sizeSelect.value[0]))
    let nTotalRows = Math.ceil(nVideoBoxes / nRowsOnScreen);
    let rowHeight = screenHeight / nRowsOnScreen;
    let rowWidth = gridWidth / nRowsOnScreen;
    // Ensure the box's height fits all videoBoxes, but at least
    // enough rows (can be empty) to fill the entire screen.
    let newBoxHeight = rowHeight * Math.max(nTotalRows, nRowsOnScreen);

    videoBoxGrid.style.height = newBoxHeight + "px";
    console.debug("New videoBoxGrid height: " + newBoxHeight);

    // Change videoSelector width (or height) to half of the rowWidth
    // (or rowHeight) to always fit the videoSelector inside the
    // overlay.
    let dim = {};
    let sizeFactor = 2/3;
    if  (rowWidth / rowHeight < gridWidth / newBoxHeight) {
        // height for width
        dim.width = Math.floor(rowWidth * sizeFactor);
        // dim.height:dim.widht = newBoxHeight:gridWidth
        dim.height = dim.width / gridWidth * newBoxHeight;
    } else {
        // width for height
        dim.height = Math.floor(rowHeight * sizeFactor);
        // dim.height / dim.widht = newBoxHeight / gridWidth
        dim.width = dim.height / newBoxHeight * gridWidth;
    }

    videoSelector.style.width = dim.width + "px";
    videoSelector.style.height = dim.height + "px";
}

function updateGrid() {
    updateGridColAndRows();
    updateGridHeight();
}

function onSizeSelectChange() {
    updateGrid();
    updateUrl();
}

// Update the browsing history by appending an URL that reflects the
// currently added videos and page settings.
function updateUrl() {
    let addVparam = videoBoxOrder.size > 0

    // this is needed so it works if the page is on the local file
    // system.
    // file:///home/user/youtube-multiview/watch?v=1,2,3
    let fullPath = document.URL.split("?")[0];
    let newUrl = fullPath
    // Add ?v= parameter
    if (addVparam) {
        newUrl += "?v="
        let ids = [];
        for (let i = 0; i < videoBoxOrder.size; i++) {
            ids.push(videoBoxOrder.get(i).videoid);
        }
        newUrl += ids.join(",");
    }

    // dim= parameter
    newUrl += (addVparam ? "&" : "?") + "dim=" + sizeSelect.value;

    // autoplay=(0|1) parameter
    newUrl += "&autoplay=" + (autoplay ? "1" : "0");

    // debug parameter (no values recognized)
    newUrl += debug ? "&debug" : "";

    console.debug("Updating URL: " + newUrl);
    history.replaceState({}, "", newUrl);
}

// Show settingsBar and hide again after @timeout ms if @timeout is <= 0,
// don't hide it again at all.
function showSettingsBar(timeout = 0) {
    if (hideSettingsBarTimeout !== null) {
        clearTimeout(hideSettingsBarTimeout);
        hideSettingsBarTimeout = null;
    }

    settingsBar.style.bottom = "0";
    if (timeout > 0) {
        hideSettingsBarTimeout = setTimeout(hideSettingsBar, timeout);
    }
}

function hideSettingsBar() {
    if (hideSettingsBarTimeout !== null) {
        clearTimeout(hideSettingsBarTimeout);
        hideSettingsBarTimeout = null;
    }
    settingsBar.style.bottom = -settingsBar.getClientRects()[0].height + "px";
}

function onScroll(e) {
    console.log("onScroll, deltaY:", e);
    showSettingsBar(2000);
}

function connectSettingsBarEvents(connect) {
    settingsBar.onmouseenter = connect ? e => {
        showSettingsBar();
    }: null;
    settingsBar.onmouseleave = connect ? e => {
        // show for two more seconds, then hide again
        showSettingsBar(2000);
    }: null;
}

function init() {
    // elements and setup not in the html file
    videoSelector = document.createElement("div");
    videoSelector.className = "video-selector";
    fillSizeSelect();

    // connect to events
    window.onresize = (e) => {
        updateGrid();
    }

    playAllButton.onclick = playAllIframes;
    pauseAllButton.onclick = pauseAllIframes;
    liveAllButton.onclick = liveAllIframes;

    urlButton.onclick = processUrlInput;
    urlInput.addEventListener('keydown', (e) => {
        if (e.key == "Enter") {
            processUrlInput();
        }
    })

    autoplayCheckbox.onchange = (change) => {
        autoplay = autoplayCheckbox.checked;
        updateUrl();
    }

    sizeSelect.onchange = onSizeSelectChange;
    editButton.onclick = toggleEditMode;

    connectSettingsBarEvents(true);
    settingsBarTrigger.onmousemove = showSettingsBar;
    connectSettingsBarEvents(true);
    document.addEventListener("scroll", onScroll);

    // load videos from URL
    processURL();
    showSettingsBar(2000);
}

window.onload = init;

/*
  References

  [#0] https://stackoverflow.com/questions/7443578/youtube-iframe-api-how-do-i-control-an-iframe-player-thats-already-in-the-html
*/
