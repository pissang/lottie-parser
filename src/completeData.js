// Data preprocess for different versions from
// https://github.com/airbnb/lottie-web/blob/master/player/js/utils/DataManager.js

function completeLayers(layers, comps) {
  var layerData;
  var i;
  var len = layers.length;
  var j;
  var jLen;
  var k;
  var kLen;
  for (i = 0; i < len; i += 1) {
    layerData = layers[i];
    if ('ks' in layerData && !layerData.completed) {
      layerData.completed = true;
      if (layerData.tt) {
        layers[i - 1].td = layerData.tt;
      }
      if (layerData.hasMask) {
        var maskProps = layerData.masksProperties;
        jLen = maskProps.length;
        for (j = 0; j < jLen; j += 1) {
          if (maskProps[j].pt.k.i) {
            convertPathsToAbsoluteValues(maskProps[j].pt.k);
          } else {
            kLen = maskProps[j].pt.k.length;
            for (k = 0; k < kLen; k += 1) {
              if (maskProps[j].pt.k[k].s) {
                convertPathsToAbsoluteValues(maskProps[j].pt.k[k].s[0]);
              }
              if (maskProps[j].pt.k[k].e) {
                convertPathsToAbsoluteValues(maskProps[j].pt.k[k].e[0]);
              }
            }
          }
        }
      }
      if (layerData.ty === 0) {
        layerData.layers = findCompLayers(layerData.refId, comps);
        completeLayers(layerData.layers, comps);
      } else if (layerData.ty === 4) {
        completeShapes(layerData.shapes);
      } else if (layerData.ty === 5) {
        completeText(layerData);
      }
    }
  }
}

function findCompLayers(id, comps) {
  var i = 0;
  var len = comps.length;
  while (i < len) {
    if (comps[i].id === id) {
      if (!comps[i].layers.__used) {
        comps[i].layers.__used = true;
        return comps[i].layers;
      }
      return JSON.parse(JSON.stringify(comps[i].layers));
    }
    i += 1;
  }
  return null;
}

function completeShapes(arr) {
  var i;
  var len = arr.length;
  var j;
  var jLen;
  for (i = len - 1; i >= 0; i -= 1) {
    if (arr[i].ty === 'sh') {
      if (arr[i].ks.k.i) {
        convertPathsToAbsoluteValues(arr[i].ks.k);
      } else {
        jLen = arr[i].ks.k.length;
        for (j = 0; j < jLen; j += 1) {
          if (arr[i].ks.k[j].s) {
            convertPathsToAbsoluteValues(arr[i].ks.k[j].s[0]);
          }
          if (arr[i].ks.k[j].e) {
            convertPathsToAbsoluteValues(arr[i].ks.k[j].e[0]);
          }
        }
      }
    } else if (arr[i].ty === 'gr') {
      completeShapes(arr[i].it);
    }
  }
}

function convertPathsToAbsoluteValues(path) {
  var i;
  var len = path.i.length;
  for (i = 0; i < len; i += 1) {
    path.i[i][0] += path.v[i][0];
    path.i[i][1] += path.v[i][1];
    path.o[i][0] += path.v[i][0];
    path.o[i][1] += path.v[i][1];
  }
}

function checkVersion(minimum, animVersionString) {
  var animVersion = animVersionString
    ? animVersionString.split('.')
    : [100, 100, 100];
  if (minimum[0] > animVersion[0]) {
    return true;
  }
  if (animVersion[0] > minimum[0]) {
    return false;
  }
  if (minimum[1] > animVersion[1]) {
    return true;
  }
  if (animVersion[1] > minimum[1]) {
    return false;
  }
  if (minimum[2] > animVersion[2]) {
    return true;
  }
  if (animVersion[2] > minimum[2]) {
    return false;
  }
  return null;
}

var checkText = (function () {
  var minimumVersion = [4, 4, 14];

  function updateTextLayer(textLayer) {
    var documentData = textLayer.t.d;
    textLayer.t.d = {
      k: [
        {
          s: documentData,
          t: 0,
        },
      ],
    };
  }

  function iterateLayers(layers) {
    var i;
    var len = layers.length;
    for (i = 0; i < len; i += 1) {
      if (layers[i].ty === 5) {
        updateTextLayer(layers[i]);
      }
    }
  }

  return function (animationData) {
    if (checkVersion(minimumVersion, animationData.v)) {
      iterateLayers(animationData.layers);
      if (animationData.assets) {
        var i;
        var len = animationData.assets.length;
        for (i = 0; i < len; i += 1) {
          if (animationData.assets[i].layers) {
            iterateLayers(animationData.assets[i].layers);
          }
        }
      }
    }
  };
})();

var checkChars = (function () {
  var minimumVersion = [4, 7, 99];
  return function (animationData) {
    if (animationData.chars && !checkVersion(minimumVersion, animationData.v)) {
      var i;
      var len = animationData.chars.length;
      var j;
      var jLen;
      var pathData;
      var paths;
      for (i = 0; i < len; i += 1) {
        if (animationData.chars[i].data && animationData.chars[i].data.shapes) {
          paths = animationData.chars[i].data.shapes[0].it;
          jLen = paths.length;

          for (j = 0; j < jLen; j += 1) {
            pathData = paths[j].ks.k;
            if (!pathData.__converted) {
              convertPathsToAbsoluteValues(paths[j].ks.k);
              pathData.__converted = true;
            }
          }
        }
      }
    }
  };
})();

var checkPathProperties = (function () {
  var minimumVersion = [5, 7, 15];

  function updateTextLayer(textLayer) {
    var pathData = textLayer.t.p;
    if (typeof pathData.a === 'number') {
      pathData.a = {
        a: 0,
        k: pathData.a,
      };
    }
    if (typeof pathData.p === 'number') {
      pathData.p = {
        a: 0,
        k: pathData.p,
      };
    }
    if (typeof pathData.r === 'number') {
      pathData.r = {
        a: 0,
        k: pathData.r,
      };
    }
  }

  function iterateLayers(layers) {
    var i;
    var len = layers.length;
    for (i = 0; i < len; i += 1) {
      if (layers[i].ty === 5) {
        updateTextLayer(layers[i]);
      }
    }
  }

  return function (animationData) {
    if (checkVersion(minimumVersion, animationData.v)) {
      iterateLayers(animationData.layers);
      if (animationData.assets) {
        var i;
        var len = animationData.assets.length;
        for (i = 0; i < len; i += 1) {
          if (animationData.assets[i].layers) {
            iterateLayers(animationData.assets[i].layers);
          }
        }
      }
    }
  };
})();

var checkColors = (function () {
  var minimumVersion = [4, 1, 9];

  function iterateShapes(shapes) {
    var i;
    var len = shapes.length;
    var j;
    var jLen;
    for (i = 0; i < len; i += 1) {
      if (shapes[i].ty === 'gr') {
        iterateShapes(shapes[i].it);
      } else if (shapes[i].ty === 'fl' || shapes[i].ty === 'st') {
        if (shapes[i].c.k && shapes[i].c.k[0].i) {
          jLen = shapes[i].c.k.length;
          for (j = 0; j < jLen; j += 1) {
            if (shapes[i].c.k[j].s) {
              shapes[i].c.k[j].s[0] /= 255;
              shapes[i].c.k[j].s[1] /= 255;
              shapes[i].c.k[j].s[2] /= 255;
              shapes[i].c.k[j].s[3] /= 255;
            }
            if (shapes[i].c.k[j].e) {
              shapes[i].c.k[j].e[0] /= 255;
              shapes[i].c.k[j].e[1] /= 255;
              shapes[i].c.k[j].e[2] /= 255;
              shapes[i].c.k[j].e[3] /= 255;
            }
          }
        } else {
          shapes[i].c.k[0] /= 255;
          shapes[i].c.k[1] /= 255;
          shapes[i].c.k[2] /= 255;
          shapes[i].c.k[3] /= 255;
        }
      }
    }
  }

  function iterateLayers(layers) {
    var i;
    var len = layers.length;
    for (i = 0; i < len; i += 1) {
      if (layers[i].ty === 4) {
        iterateShapes(layers[i].shapes);
      }
    }
  }

  return function (animationData) {
    if (checkVersion(minimumVersion, animationData.v)) {
      iterateLayers(animationData.layers);
      if (animationData.assets) {
        var i;
        var len = animationData.assets.length;
        for (i = 0; i < len; i += 1) {
          if (animationData.assets[i].layers) {
            iterateLayers(animationData.assets[i].layers);
          }
        }
      }
    }
  };
})();

var checkShapes = (function () {
  var minimumVersion = [4, 4, 18];

  function completeClosingShapes(arr) {
    var i;
    var len = arr.length;
    var j;
    var jLen;
    for (i = len - 1; i >= 0; i -= 1) {
      if (arr[i].ty === 'sh') {
        if (arr[i].ks.k.i) {
          arr[i].ks.k.c = arr[i].closed;
        } else {
          jLen = arr[i].ks.k.length;
          for (j = 0; j < jLen; j += 1) {
            if (arr[i].ks.k[j].s) {
              arr[i].ks.k[j].s[0].c = arr[i].closed;
            }
            if (arr[i].ks.k[j].e) {
              arr[i].ks.k[j].e[0].c = arr[i].closed;
            }
          }
        }
      } else if (arr[i].ty === 'gr') {
        completeClosingShapes(arr[i].it);
      }
    }
  }

  function iterateLayers(layers) {
    var layerData;
    var i;
    var len = layers.length;
    var j;
    var jLen;
    var k;
    var kLen;
    for (i = 0; i < len; i += 1) {
      layerData = layers[i];
      if (layerData.hasMask) {
        var maskProps = layerData.masksProperties;
        jLen = maskProps.length;
        for (j = 0; j < jLen; j += 1) {
          if (maskProps[j].pt.k.i) {
            maskProps[j].pt.k.c = maskProps[j].cl;
          } else {
            kLen = maskProps[j].pt.k.length;
            for (k = 0; k < kLen; k += 1) {
              if (maskProps[j].pt.k[k].s) {
                maskProps[j].pt.k[k].s[0].c = maskProps[j].cl;
              }
              if (maskProps[j].pt.k[k].e) {
                maskProps[j].pt.k[k].e[0].c = maskProps[j].cl;
              }
            }
          }
        }
      }
      if (layerData.ty === 4) {
        completeClosingShapes(layerData.shapes);
      }
    }
  }

  return function (animationData) {
    if (checkVersion(minimumVersion, animationData.v)) {
      iterateLayers(animationData.layers);
      if (animationData.assets) {
        var i;
        var len = animationData.assets.length;
        for (i = 0; i < len; i += 1) {
          if (animationData.assets[i].layers) {
            iterateLayers(animationData.assets[i].layers);
          }
        }
      }
    }
  };
})();

export function completeData(animationData) {
  if (animationData.__complete) {
    return;
  }
  checkColors(animationData);
  checkText(animationData);
  checkChars(animationData);
  checkPathProperties(animationData);
  checkShapes(animationData);
  completeLayers(animationData.layers, animationData.assets);
  animationData.__complete = true;
}

function completeText(data) {
  if (data.t.a.length === 0 && !('m' in data.t.p)) {
    data.singleShape = true;
  }
}
