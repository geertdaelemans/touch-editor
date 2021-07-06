export default class Network {
    constructor() {
        this._network = null;
        this._nodes = null;
        this._edges = null;
    }
    get network() {
        return this._network;
    }
    set network(network) {
        this._network = network;
    }
    get nodes() {
        return this._nodes;
    }
    set nodes(nodes) {
        this._nodes = nodes;
    }
    get edges() {
        return this._edges;
    }
    set edges(edges) {
        this._edges = edges;
    }

    // Create the network
    drawNetwork(callBack) {
        let container = $('#pageNetwork');
        container.width($('#page-content-wrapper').width());
        container.height($('#sidebar-left').height()-12);
        let data = {
            nodes: this.nodes,
            edges: this.edges
        };
        let options = {
            physics: {
                enabled: true,
                minVelocity: 0.75,
                barnesHut: {
                    springConstant: 0.05,
                    damping: 0.92,
                    avoidOverlap: 1
                },
            },
            nodes: {
                mass: 10,
                fixed: { 
                    y: true
                }
            },
            configure: {
                enabled: true,
                filter: 'physics, layout',
                showButton: true
            }
        };
        if (this.network) {
            this.network.destroy();
        }
        this.network = new vis.Network(container[0], data, options);
        this.network.stabilize(20);

        // Handle right-click on node
        this.network.on('oncontext', function(parameters) {
            parameters.event.preventDefault();
            let selectedNode = this.getNodeAt(parameters.pointer.DOM);
            if (selectedNode != 'undefined') {
                callBack(selectedNode);
            }
        });
    }

    calculateNetwork(currentStatus) {
        // Add navigational edges
        function addNavigationalEdges(source, direction, pageId) {
            let to = -1;
            if (source[direction] == '[NEXT]') {
                to = pageId + 1 < numberMap.length ? pageId + 1 : -1;
            } else if (source[direction] == '[PREV]') {
                to = pageId - 1;
            } else if (source[direction] == '[ROOT]') {
                to = 0;
            } else if (source[direction] == '[UNDO]') {
                to = -1;
            } else {
                to = numberMap.indexOf(source[direction]);
            }
            if (to != -1) {
                let color;
                if (direction == 'url')
                    color = 'blue'
                else if (direction == 'next')
                    color = 'red';
                else if (direction == 'back')
                    color = 'purple';
                else if (direction == 'up')
                    color = 'green';
                else
                    color = 'yellow';
                let nextEdge = {
                    from: pageId,
                    to: to,
                    color: color,
                    smooth: {
                        type: "cubicBezier"
                    },
                    arrows: {
                        to: {
                            enabled: true,
                            type: 'arrow'
                        }
                    }
                }
                edges_temp.push(nextEdge);
            }
        }
        // Recursive function to include levels
        function setLevel(nodeId, level) {
            nodes_temp[nodeId].level = level;
            nodes_temp[nodeId].y = level * 200;
            edges_temp.forEach(u => {
                if (u.from == nodeId && nodes_temp[u.to].level == -1) {
                    setLevel(u.to, level+1);
                }
            })
        }
        let numberMap = [];
        for (let page in currentStatus.data) {
            numberMap.push(currentStatus.data[page].id);
        }
    
        let nodes_temp = [];
        let edges_temp = [];
        for (let page in currentStatus.data) {
            let pageId = Number(page);
            let thumbnail = "page_" + currentStatus.data[pageId].id + "_small.png";
            let node = {
                id: pageId,
                label: numberMap[pageId],
                shape: "box",
                size: 50,
                margin: { top: 10, right: 10, bottom: 10, left: 10 },
                level: -1
            }
            if (thumbnail in currentStatus.screenshots) {
                node.image = encodeURIComponent(currentStatus.presentationFolder + currentStatus.projectName + '/screenshots/' + thumbnail) + '?t=' + new Date().getTime();
                node.shape = "image";
            }
            if (pageId == 0) {
                node.color = 'red';
                node.font = {
                    color: 'white'
                }
            }
            nodes_temp.push(node);
            if (currentStatus.data[pageId].next) {
                addNavigationalEdges(currentStatus.data[pageId], 'next', pageId);
            }
            if (currentStatus.data[pageId].back) {
                addNavigationalEdges(currentStatus.data[pageId], 'back', pageId);
            }
            if (currentStatus.data[pageId].up) {
                addNavigationalEdges(currentStatus.data[pageId], 'up', pageId);
            }
            if (currentStatus.data[pageId].down) {
                addNavigationalEdges(currentStatus.data[pageId], 'down', pageId);
            }
            if (currentStatus.data[pageId].asset != undefined) {
                let assetArray = [];
                // Make a clean array with all assets
                if (Array.isArray(currentStatus.data[pageId].asset)) { 
                    assetArray = currentStatus.data[pageId].asset;
                } else {
                    assetArray.push(currentStatus.data[pageId].asset);
                }
                for (let assetId in assetArray) {
                    if (assetArray[assetId].url) {
                        addNavigationalEdges(assetArray[assetId], 'url', pageId);
                    }
                }
            }
        }
        if (nodes_temp.length != 0) {
            setLevel(0, 0);
            if (this.nodes) {
                this.nodes = undefined;
            }
            this.nodes = new vis.DataSet(nodes_temp);
            if (this.edges) {
                this.edges = undefined;
            }
            this.edges = new vis.DataSet(edges_temp);
            this.drawNetwork();
        }
    }
}