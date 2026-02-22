// ■■■■■■■■■■■■■■■■■■■■■■  Folder Storage  ■■■■■■■■■■■■■■■■■■■■■■ //

// ┏━━━━━━━━━━━━━━━━━━┫  DOM Element Caching  ┣━━━━━━━━━━━━━━━━━━┓ //

const folderStorage = document.getElementById('folder-storage');
const mysetCount = document.getElementById('myset-count');
const folderArea = document.getElementById('folder-area');
const funitCreateFareaBtn = document.getElementById('funit-create-farea-btn');

// ┏━━━━━━━━━━━━━━━━━━┫  Variable Caching  ┣━━━━━━━━━━━━━━━━━━┓ //

let subnaviOpenFunitId = null;

const folderTree = {
    id: "ROOT",
    name: "ROOT",
    childrenFunit: [],
    childrenWset: []
};

// ┏━━━━━━━━━━━━━━━━━━┫  Utils : Sort  ┣━━━━━━━━━━━━━━━━━━┓ //

function sortByNameAsc(arr) {
    arr.sort((a, b) => {
        return a.name.localeCompare(b.name, 'ko');
    });
}

// ┏━━━━━━━━━━━━━━━━━━┫  Create Folder Unit  ┣━━━━━━━━━━━━━━━━━━┓ //

function createFolder(folderName, parentId, returnThisId = false) {
    const folder = {
        id: crypto.randomUUID(),
        name: folderName,
        childrenFunit: [],
        childrenWset: []
    };

    const targetNode = findFolderTreeNode(folderTree, parentId);
    if (targetNode) {
        targetNode.childrenFunit.push(folder);
        sortByNameAsc(targetNode.childrenFunit);
    }
    else {
        console.error(`[findFolderTreeNode] targetId "${parentId}" 에 해당하는 노드를 찾을 수 없습니다.`);
    }

    if (returnThisId) {
        return folder.id;
    }
}

function findFolderTreeNode(node, targetId) {
    if (node.id === targetId) return node;

    for (const child of node.childrenFunit) {
        const foundNode = findFolderTreeNode(child, targetId);
        if (foundNode) return foundNode;
    }

    return null;
}

// ┏━━━━━━━━━━━━━━━━━━┫  Create Wset  ┣━━━━━━━━━━━━━━━━━━┓ //

function createWset(wsetName, parentId) {
    const wset = {
        id: crypto.randomUUID(),
        name: wsetName
    };

    const targetNode = findFolderTreeNode(folderTree, parentId);
    if (targetNode) {
        targetNode.childrenWset.push(wset);
        sortByNameAsc(targetNode.childrenWset);
        updateCountWset();
    }
    else {
        console.error(`[findFolderTreeNode] targetId "${parentId}" 에 해당하는 노드를 찾을 수 없습니다.`);
    }
}

// ┏━━━━━━━━━━━━━━━━━━┫  Render Storage  ┣━━━━━━━━━━━━━━━━━━┓ //

const funitManagerMap = new Map();

function renderNode(node, wraper) {
    for (const childFunit of node.childrenFunit) {

        let funitProxyManager = funitManagerMap.get(childFunit.id);
        if (!funitProxyManager) {
            funitProxyManager = createFunitProxy(new funitManager(childFunit.id));
            funitManagerMap.set(childFunit.id, funitProxyManager);
        }

        const thisFunit = document.createElement('div');
        thisFunit.className = "folder-unit";
        thisFunit.dataset.unitId = childFunit.id;
        thisFunit.innerHTML = `
            <div class="funit-body">
                <div class="funit-icon">
                    <i class="fa-solid fa-chevron-right"></i>
                </div>
                <div class="folder-name">
                    <input class="funit-input" type="text" value="${childFunit.name}" readonly>
                </div>
                <div class="funit-subnavi">
                    <div class="subnavi-btn">
                        <i class="fa-solid fa-ellipsis"></i>
                    </div>
                    <div class="funit-subnavi-inner">
                        <div class="funit-rename-btn" data-tooltip="이름 변경">
                            <i class="fa-solid fa-pen"></i>
                        </div>
                        <div class="funit-remove-btn" data-tooltip="폴더 삭제">
                            <i class="fa-solid fa-trash"></i>
                        </div>
                        <div class="funit-create-btn" data-tooltip="폴더 추가">
                            <i class="fa-solid fa-folder-plus"></i>
                        </div>
                    </div>
                </div>
            </div>
        `;
        wraper.appendChild(thisFunit);

        const unitWraper = document.createElement('div');
        unitWraper.className = "unit-wraper";
        thisFunit.appendChild(unitWraper);

        syncFunitOpenState(funitProxyManager);
        renderNode(childFunit, unitWraper);
    }

    for (const childWset of node.childrenWset) {
        const thisWset = document.createElement('div');
        thisWset.className = "wset-unit";
        thisWset.dataset.unitId = childWset.id;
        thisWset.innerHTML = `
            <div class="wset-icon">
                <i class="fa-solid fa-inbox"></i>
            </div>
            <div class="wset-name">${childWset.name}</div>
        `;
        wraper.appendChild(thisWset);
    }
}

function renderStorage() {
    folderArea.innerHTML = '';
    renderNode(folderTree, folderArea);
}

// ┏━━━━━━━━━━━━━━━━━━┫  funitManager & funitProxy  ┣━━━━━━━━━━━━━━━━━━┓ //

class funitManager {
    constructor(id) {
        this.id = id;
        this.isFunitOpen = false;
        this.isSubnaviOpen = false;
    }

    toggleSubnaviOpen() {
        this.isSubnaviOpen ? this.closeSubnavi() : this.openSubnavi();
    }
    openSubnavi() {
        this.isSubnaviOpen = true;
    }
    closeSubnavi() {
        this.isSubnaviOpen = false;
    }

    toggleFunitOpen() {
        this.isFunitOpen ? this.closeFunit() : this.openFunit();
    }
    openFunit() {
        this.isFunitOpen = true;
    }
    closeFunit() {
        this.isFunitOpen = false;
    }
}

function createFunitProxy(manager) {
    return new Proxy(manager, {
        set(target, prop, value) {
            target[prop] = value;

            if (prop === 'isSubnaviOpen') {
                syncSubnaviOpenState(target);
            }

            if (prop === 'isFunitOpen') {
                syncFunitOpenState(target);
            }

            return true;
        }
    });
}

// ┏━━━━━━━━━━━━━━━━━━┫  Find folder unit by id  ┣━━━━━━━━━━━━━━━━━━┓ //

function getFunitElement(id) {
    return document.querySelector(`.folder-unit[data-unit-id="${id}"]`);
}

// ┏━━━━━━━━━━━━━━━━━━┫  Apply state function  ┣━━━━━━━━━━━━━━━━━━┓ //

function syncSubnaviOpenState(manager) {
    const funitElement = getFunitElement(manager.id);
    if (!funitElement) return;

    funitElement.classList.toggle('subnavi-open', manager.isSubnaviOpen);

    if (manager.isSubnaviOpen) {
        subnaviOpenFunitId = manager.id;
    }
    if (!manager.isSubnaviOpen && subnaviOpenFunitId === manager.id) {
        subnaviOpenFunitId = null;
    }
}

function syncFunitOpenState(manager) {
    const funitElement = getFunitElement(manager.id);
    if (!funitElement) return;

    funitElement.classList.toggle('folder-open', manager.isFunitOpen);
}

// ┏━━━━━━━━━━━━━━━━━━┫  Count wset  ┣━━━━━━━━━━━━━━━━━━┓ //

function countWset(node = folderTree) {
    let count = node.childrenWset.length;

    for (const child of node.childrenFunit) {
        count += countWset(child);
    }

    return count;
}

function updateCountWset() {
    mysetCount.innerHTML = `내 세트 : ${countWset()}`;
}

// ┏━━━━━━━━━━━━━━━━━━┫  Open/Close folder  ┣━━━━━━━━━━━━━━━━━━┓ //

folderArea.addEventListener('click', function (e) {
    const eFunit = e.target.closest('.folder-unit');
    if (!eFunit) return;

    const eFunitBody = e.target.closest('.funit-body');
    const eFunitSubnavi = e.target.closest('.funit-subnavi');

    const funitProxyManager = funitManagerMap.get(eFunit.dataset.unitId);

    if (!eFunitBody || eFunitSubnavi) return;
    if (!funitProxyManager) return;

    funitProxyManager.toggleFunitOpen();
});

// ┏━━━━━━━━━━━━━━━━━━┫  Open/Close Subnavi  ┣━━━━━━━━━━━━━━━━━━┓ //

folderArea.addEventListener('click', function (e) {
    const eFunit = e.target.closest('.folder-unit');
    if (!eFunit) return;

    const eSubnaviBtn = e.target.closest('.subnavi-btn');
    const funitProxyManager = funitManagerMap.get(eFunit.dataset.unitId);

    if (!eSubnaviBtn) return;
    if (!funitProxyManager) return;

    if (subnaviOpenFunitId && eFunit.dataset.unitId !== subnaviOpenFunitId) {
        funitManagerMap.get(subnaviOpenFunitId).closeSubnavi();
    }

    funitProxyManager.toggleSubnaviOpen();
});

document.addEventListener('mousemove', (e) => {
    if (!subnaviOpenFunitId) return;

    const funitEl = getFunitElement(subnaviOpenFunitId);
    if (!funitEl) return;

    const funitBody = funitEl.querySelector(':scope > .funit-body');
    if (!funitBody) return;

    if (!funitBody.contains(e.target)) {
        funitManagerMap.get(subnaviOpenFunitId).closeSubnavi();
    }
});

// ┏━━━━━━━━━━━━━━━━━━┫  [Folder] create  ┣━━━━━━━━━━━━━━━━━━┓ //

funitCreateFareaBtn.addEventListener('click', () => {

});

// =============== 폴더 생성 테스트 =============== //

const a1 = createFolder("wls 시작", "ROOT", true);
const a2 = createFolder("새로운 시작", a1, true);
createFolder("내부 폴더", a2);
createWset("wset 000", a2);
createFolder('aaaaa 000', a1)
createFolder('aaaaa 001', a1)
createFolder('aaaaa 002', a1)

renderStorage();

// ■■■■■■■■■■■■■■■■■■■■■■  Tooltip Manager  ■■■■■■■■■■■■■■■■■■■■■■ //

class TooltipManager {
    constructor(delay = 300) {
        this.delay = delay;
        this.timer = null;

        this.tooltip = document.createElement('div');
        this.tooltip.className = 'tooltip';
        document.body.appendChild(this.tooltip);

        this.tooltipBind();
    }

    tooltipBind() {
        document.addEventListener('mouseover', this.onEnter.bind(this));
        document.addEventListener('mousemove', this.onMove.bind(this));
        document.addEventListener('mouseout', this.onLeave.bind(this));
    }

    onEnter(e) {
        const target = e.target.closest('[data-tooltip]');
        if (!target) return;

        clearTimeout(this.timer);
        this.currentTarget = target;

        this.timer = setTimeout(() => {
            if (this.currentTarget !== target) return;

            this.tooltip.textContent = target.dataset.tooltip;
            this.tooltip.classList.add('show');
        }, this.delay);
    }

    onMove(e) {
        this.tooltip.style.left = e.clientX + 10 + 'px';
        this.tooltip.style.top  = e.clientY + 18 + 'px';
    }

    onLeave(e) {
        if (!this.currentTarget) return;

        if (e.relatedTarget && this.currentTarget.contains(e.relatedTarget)) return;

        clearTimeout(this.timer);
        this.tooltip.classList.remove('show');
        this.currentTarget = null;
    }
}

new TooltipManager();
