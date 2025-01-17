import { map } from 'd3-collection';

export default function(paths) {
    var _nodes, _inputPaths = paths || [], _paths, _id = function(n) { return n.index; };
    var _angleForce = 0.01, _pathNodes, _pathStrength, _debug = false;
    var force = function(alpha) {
        function _dot(v1, v2) { return  v1.x*v2.x + v1.y*v2.y; };
        function _len(v) { return Math.sqrt(v.x*v.x + v.y*v.y); };
        function _angle(v1, v2) {
            var a = _dot(v1, v2) / (_len(v1)*_len(v2));
            a = Math.min(a, 1);
            a = Math.max(a, -1);
            return Math.acos(a);
        };
        // perpendicular unit length vector
        function _pVec(v) {
            var xx = -v.y/v.x, yy = 1;
            var length = _len({x: xx, y: yy});
            return {x: xx/length, y: yy/length};
        };

        function _displaceAdjacent(node, angle, pVec, k) {
            var turn = Math.PI-angle,
                turn2 = turn*turn;
            return {
                kind: 'adjacent',
                x: pVec.x*turn2*k,
                y: pVec.y*turn2*k
            };
        }

        function _displaceCenter(dadj1, dadj2) {
            return {
                kind: 'center',
                x: -(dadj1.x + dadj2.x),
                y: -(dadj1.y + dadj2.y)
            };
        }

        function _offsetNode(node, disp) {
            node.x += disp.x;
            node.y += disp.y;
        }
        var report = [];
        _paths.forEach(function(path, i) {
            var pnodes = path.nodes,
                strength = path.strength;
            if(typeof strength !== 'number')
                strength = 1;
            if(pnodes.length < 3) return; // at least 3 nodes (and 2 edges):  A->B->C
            if(_debug) {
                report.push({
                    action: 'init',
                    nodes: pnodes.map(function(n) {
                        return {
                            id: _id(n),
                            x: n.x,
                            y: n.y
                        };
                    }),
                    edges: pnodes.reduce(function(p, n) {
                        if(!Array.isArray(p))
                            return [{source: _id(p), target: _id(n)}];
                        p.push({source: p[p.length-1].target, target: _id(n)});
                        return p;
                    })
                });
            }
            for(var i = 1; i < pnodes.length-1; ++i) {
                var current = pnodes[i];
                var prev = pnodes[i-1];
                var next = pnodes[i+1];

                // we can't do anything for two-cycles
                if(prev === next)
                    continue;

                // calculate the angle
                var vPrev = {x: prev.x - current.x, y: prev.y - current.y};
                var vNext = {x: next.x - current.x, y: next.y - current.y};

                var angle = _angle(vPrev, vNext); // angle in [0, PI]

                var pvecPrev = _pVec(vPrev);
                var pvecNext = _pVec(vNext);

                // make sure the perpendicular vector is in the
                // direction that makes the angle more towards 180 degree
                // 1. calculate the middle point of node 'prev' and 'next'
                var mid = {x: (prev.x+next.x)/2.0, y: (prev.y+next.y)/2.0};

                // 2. calculate the vectors: 'prev' pointing to 'mid', 'next' pointing to 'mid'
                var prev_mid = {x: mid.x-prev.x, y: mid.y-prev.y};
                var next_mid = {x: mid.x-next.x, y: mid.y-next.y};

                // 3. the 'correct' vector: the angle between pvec and prev_mid(next_mid) should
                //    be an obtuse angle
                pvecPrev = _angle(prev_mid, pvecPrev) >= Math.PI/2.0 ? pvecPrev : {x: -pvecPrev.x, y: -pvecPrev.y};
                pvecNext = _angle(next_mid, pvecNext) >= Math.PI/2.0 ? pvecNext : {x: -pvecNext.x, y: -pvecNext.y};

                // modify positions of nodes
                var prevDisp = _displaceAdjacent(prev, angle, pvecPrev, strength * _angleForce);
                var nextDisp = _displaceAdjacent(next, angle, pvecNext, strength * _angleForce);
                var centerDisp = _displaceCenter(prevDisp, nextDisp);
                if(_debug) {
                    report.push({
                        action: 'force',
                        nodes: [{
                            id: _id(prev),
                            x: prev.x,
                            y: prev.y,
                            force: prevDisp
                        }, {
                            id: _id(current),
                            x: current.x,
                            y: current.y,
                            force: centerDisp
                        }, {
                            id: _id(next),
                            x: next.x,
                            y: next.y,
                            force: nextDisp
                        }],
                        edges: [{
                            source: _id(prev),
                            target: _id(current)
                        }, {
                            source: _id(current),
                            target: _id(next)
                        }]
                    });
                }
                _offsetNode(prev, prevDisp);
                _offsetNode(next, nextDisp);
                _offsetNode(current, centerDisp);
            }
        });
        if(_debug)
            console.log(report);
    };
    function find(nodeById, nodeId) {
        var node = nodeById.get(nodeId);
        if(!node)
            throw new Error('node missing: ' + nodeId);
        return node;
    }
    function init() {
        if(!_nodes)
            return;
        var nodeById = map(_nodes, _id);
        _paths = _inputPaths.map(function(path) {
            return {
                nodes: _pathNodes(path).map(function(n) {
                    return typeof n !== 'object' ?
                        find(nodeById, n) :
                        n;
                }),
                strength: _pathStrength(path)
            };
        });
    }
    force.initialize = function(nodes) {
        _nodes = nodes;
        init();
    };
    force.paths = function(paths) {
        if(!arguments.length) return _paths;
        _inputPaths = paths;
        init();
        return this;
    };
    force.id = function(id) {
        if(!arguments.length) return _id;
        _id = id;
        return this;
    };
    force.angleForce = function(angleForce) {
        if(!arguments.length) return _angleForce;
        _angleForce = angleForce;
        return this;
    };
    force.pathNodes = function(pathNodes) {
        if(!arguments.length) return _pathNodes;
        _pathNodes = pathNodes;
        return this;
    };
    force.pathStrength = function(pathStrength) {
        if(!arguments.length) return _pathStrength;
        _pathStrength = pathStrength;
        return this;
    };
    force.debug = function(debug) {
        if(!arguments.length) return _debug;
        _debug = debug;
        return this;
    };
    return force;
}
