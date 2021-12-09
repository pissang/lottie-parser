import * as Lottie from './lottie.type';
import type { ElementProps, PathProps, RectProps } from 'zrender';
import { util } from 'zrender';
import { install } from './installLottieShapes';
// @ts-ignore
import { completeData } from './completeData';

interface KeyframeAnimationKeyframe {
  easing?: string;
  percent: number;
  [key: string]: any;
}

interface KeyframeAnimation {
  duration?: number;
  delay?: number;
  easing?: number;
  keyframes?: Record<string, any>[];
}

interface CustomElementOption extends ElementProps {
  type: string;
  anchorX?: number;
  anchorY?: number;
  keyframeAnimation?: KeyframeAnimation[];
  children?: CustomElementOption[];
}

class ParseContext {
  frameTime = 1000 / 30;
  startFrame = 0;
  endFrame: number;
}

function isNumberArray(val: any): val is number[] {
  return Array.isArray(val) && typeof val[0] === 'number';
}

function isMultiDimensionalValue(val?: { k?: any }): val is { k: number[] } {
  return isNumberArray(val?.k);
}

function isMultiDimensionalKeyframedValue(val?: {
  k?: any;
}): val is { k: Lottie.OffsetKeyframe[] } {
  const k = val?.k;
  return Array.isArray(k) && k[0].t !== undefined && isNumberArray(k[0].s);
}

function isValue(val?: { k?: any }): val is { k: number } {
  // TODO is [100] sort of value?
  return typeof val?.k === 'number';
}

function isKeyframedValue(val?: {
  k?: any;
}): val is { k: Lottie.OffsetKeyframe[] } {
  const k = val?.k;
  return Array.isArray(k) && k[0].t !== undefined && typeof k[0].s === 'number';
}

function toColorString(val: number | number[]) {
  return `rgba(${[
    Math.round(getMultiDimensionValue(val, 0) * 255),
    Math.round(getMultiDimensionValue(val, 1) * 255),
    Math.round(getMultiDimensionValue(val, 2) * 255),
    getMultiDimensionValue(val, 3),
  ].join(',')})`;
}

function getMultiDimensionValue(val: number | number[], dimIndex?: number) {
  // TODO Validate?
  return val != null
    ? typeof val === 'number'
      ? val
      : val[dimIndex || 0]
    : NaN;
}

function getMultiDimensionEasingBezierString(
  kf: Pick<Lottie.OffsetKeyframe, 'o' | 'i'>,
  nextKf: Pick<Lottie.OffsetKeyframe, 'o' | 'i'>,
  dimIndex?: number
) {
  let bezierEasing: number[] = [];
  bezierEasing.push(
    kf.o?.x ? getMultiDimensionValue(kf.o.x, dimIndex) : 0,
    kf.o?.y ? getMultiDimensionValue(kf.o.y, dimIndex) : 0,
    nextKf?.o?.x ? getMultiDimensionValue(nextKf.o.x, dimIndex) : 1,
    nextKf?.o?.y ? getMultiDimensionValue(nextKf.o.y, dimIndex) : 1
  );

  if (
    bezierEasing[0] &&
    bezierEasing[1] &&
    bezierEasing[2] !== 1 &&
    bezierEasing[3] !== 1
  ) {
    return `cubic-bezier(${bezierEasing.join(',')})`;
  }
  return;
}

function parseKeyframe(
  kfs: Lottie.OffsetKeyframe[],
  bezierEasingDimIndex: number,
  context: ParseContext,
  out: KeyframeAnimation,
  setVal: (kfObj: any, val: any) => void
) {
  const kfsLen = kfs.length;
  const duration = context.endFrame;

  let prevKf;
  for (let i = 0; i < kfsLen; i++) {
    const kf = kfs[i];
    const nextKf = kfs[i + 1];
    const outKeyframe: KeyframeAnimationKeyframe = {
      // Only use the first easing. TODO: Different easing?
      easing: getMultiDimensionEasingBezierString(
        kf,
        nextKf,
        bezierEasingDimIndex
      ),
      percent: kf.t / duration,
    };
    // Use end state of laster frame if start state not exits.
    const startVal = kf.s || prevKf?.e;
    if (startVal) {
      setVal(outKeyframe, startVal);
    }
    if (kf.t > 0 && i === 0) {
      // Set initial
      const initialKeyframe = {
        percent: 0,
      };
      if (startVal) {
        setVal(initialKeyframe, startVal);
      }
      out.keyframes!.push(initialKeyframe);
    }
    out.keyframes!.push(outKeyframe);
    prevKf = kf;
  }
  if (kfsLen) {
    out.duration = context.frameTime * duration;
  }
}

function parseOffsetKeyframe(
  kfs: Lottie.OffsetKeyframe[],
  targetPropName: string,
  propNames: string[],
  keyframeAnimations: KeyframeAnimation[],
  context: ParseContext,
  convertVal?: (val: number) => number
) {
  const keyframeAnim = {
    duration: 0,
    delay: 0,
    keyframes: [],
  };
  // TODO merge if bezier easing is same.
  for (let dimIndex = 0; dimIndex < propNames.length; dimIndex++) {
    const propName = propNames[dimIndex];
    parseKeyframe(
      kfs,
      dimIndex,
      context,
      keyframeAnim,
      (outKeyframe, startVal) => {
        let val = getMultiDimensionValue(startVal, dimIndex);
        if (convertVal) {
          val = convertVal(val);
        }
        (targetPropName
          ? (outKeyframe[targetPropName] = {} as any)
          : outKeyframe)[propName] = val;
      }
    );
  }

  if (keyframeAnim.keyframes.length) {
    keyframeAnimations.push(keyframeAnim);
  }
}

function parseColorOffsetKeyframe(
  kfs: Lottie.OffsetKeyframe[],
  targetPropName: string,
  propName: string,
  keyframeAnimations: KeyframeAnimation[],
  context: ParseContext
) {
  const keyframeAnim = {
    duration: 0,
    delay: 0,
    keyframes: [],
  };
  parseKeyframe(kfs, 0, context, keyframeAnim, (outKeyframe, startVal) => {
    (targetPropName ? (outKeyframe[targetPropName] = {} as any) : outKeyframe)[
      propName
    ] = toColorString(startVal);
  });
  if (keyframeAnim.keyframes.length) {
    keyframeAnimations.push(keyframeAnim);
  }
}

function parseValue(
  lottieVal: Lottie.MultiDimensional | Lottie.Value,
  attrs: Record<string, any>,
  targetPropName: string,
  propNames: string[],
  animations: KeyframeAnimation[],
  context: ParseContext,
  convertVal?: (val: number) => number
) {
  if (targetPropName) {
    attrs[targetPropName] = attrs[targetPropName] || {};
  }
  const target = targetPropName ? attrs[targetPropName] : attrs;

  if (isValue(lottieVal)) {
    const val = lottieVal.k;
    target[propNames[0]] = convertVal ? convertVal(val) : val;
  } else if (isKeyframedValue(lottieVal)) {
    parseOffsetKeyframe(
      lottieVal.k,
      targetPropName,
      propNames,
      animations,
      context,
      convertVal
    );
  } else if (isMultiDimensionalValue(lottieVal)) {
    for (let i = 0; i < propNames.length; i++) {
      const val = getMultiDimensionValue(lottieVal.k, i);
      target[propNames[i]] = convertVal ? convertVal(val) : val;
    }
  } else if (isMultiDimensionalKeyframedValue(lottieVal)) {
    // TODO Merge dimensions
    parseOffsetKeyframe(
      lottieVal.k,
      targetPropName,
      propNames,
      animations,
      context,
      convertVal
    );
  }
}

function parseTransforms(
  ks: Lottie.Transform,
  attrs: ElementProps,
  animations: KeyframeAnimation[],
  context: ParseContext
) {
  parseValue(ks.p, attrs, '', ['x', 'y'], animations, context);
  parseValue(
    ks.s,
    attrs,
    '',
    ['scaleX', 'scaleY'],
    animations,
    context,
    (val) => val / 100
  );
  parseValue(
    ks.r,
    attrs,
    '',
    ['rotation'],
    animations,
    context,
    // zrender has inversed rotation
    (val) => -(val / 180) * Math.PI
  );
  parseValue(ks.a, attrs, '', ['anchorX', 'anchorY'], animations, context);

  // TODO opacity.
  // TODO sk: skew, sa: skew axis
  // TODO px, py
}

function parseFill(
  fl: Lottie.FillShape,
  attrs: PathProps,
  animations: KeyframeAnimation[],
  context: ParseContext
) {
  attrs.style = attrs.style || {};
  // Color
  if (isMultiDimensionalValue(fl.c)) {
    attrs.style.fill = toColorString(fl.c.k);
  } else if (isMultiDimensionalKeyframedValue(fl.c)) {
    parseColorOffsetKeyframe(fl.c.k, 'style', 'fill', animations, context);
  }

  // Opacity
  parseValue(
    fl.o,
    attrs,
    'style',
    ['fillOpacity'],
    animations,
    context,
    (opacity) => opacity / 100
  );
}

function parseStroke(
  st: Lottie.StrokeShape,
  attrs: PathProps,
  animations: KeyframeAnimation[],
  context: ParseContext
) {
  attrs.style = attrs.style || {};
  // Color
  if (isMultiDimensionalValue(st.c)) {
    attrs.style.stroke = toColorString(st.c.k);
  } else if (isMultiDimensionalKeyframedValue(st.c)) {
    parseColorOffsetKeyframe(st.c.k, 'style', 'stroke', animations, context);
  }

  // Opacity
  parseValue(
    st.o,
    attrs,
    'style',
    ['strokeOpacity'],
    animations,
    context,
    (opacity) => opacity / 100
  );
  // Line width
  parseValue(st.w, attrs, 'style', ['lineWidth'], animations, context);

  switch (st.lj) {
    case Lottie.LineJoin.Bevel:
      attrs.style.lineJoin = 'bevel';
      break;
    case Lottie.LineJoin.Round:
      attrs.style.lineJoin = 'round';
      break;
    case Lottie.LineJoin.Miter:
      attrs.style.lineJoin = 'miter';
      break;
  }

  switch (st.lc) {
    case Lottie.LineCap.Butt:
      attrs.style.lineCap = 'butt';
      break;
    case Lottie.LineCap.Round:
      attrs.style.lineCap = 'round';
      break;
    case Lottie.LineCap.Square:
      attrs.style.lineCap = 'square';
      break;
  }
}

function isBezier(k: any): k is Lottie.Bezier {
  return k && k.i && k.o && k.v;
}
function parseShapePaths(
  shape: Lottie.PathShape,
  animations: KeyframeAnimation[],
  context: ParseContext
) {
  const attrs: any = {
    type: 'lottie-shape-path',
    // Should have no fill and stroke by default
    style: {
      fill: 'none',
      stroke: 'none',
    },
  };
  if (isBezier(shape.ks.k)) {
    attrs.shape = {
      in: shape.ks.k.i,
      out: shape.ks.k.o,
      v: shape.ks.k.v,
      close: shape.ks.k.c,
    };
  } else if (Array.isArray(shape.ks.k)) {
    const keyframeAnim = {
      duration: 0,
      delay: 0,
      keyframes: [],
    };
    parseKeyframe(
      shape.ks.k as any as Lottie.OffsetKeyframe[],
      0,
      context,
      keyframeAnim,
      (outKeyframe, startVal) => {
        outKeyframe.shape = {
          in: startVal[0].i,
          out: startVal[0].o,
          v: startVal[0].v,
          close: startVal[0].c,
        };
      }
    );
    if (keyframeAnim.keyframes.length) {
      animations.push(keyframeAnim);
    }
  }
  return attrs;
}

function parseShapeRect(
  shape: Lottie.RectShape,
  animations: KeyframeAnimation[],
  context: ParseContext
) {
  const attrs = {
    type: 'lottie-shape-rect',
    // Should have no fill and stroke by default
    style: {
      fill: 'none',
      stroke: 'none',
    },
    shape: {},
  } as RectProps;

  parseValue(shape.p, attrs, 'shape', ['x', 'y'], animations, context);
  parseValue(shape.s, attrs, 'shape', ['width', 'height'], animations, context);
  parseValue(shape.r, attrs, 'shape', ['r'], animations, context);

  return attrs;
}

function parseShapeEllipse(
  shape: Lottie.EllipseShape,
  animations: KeyframeAnimation[],
  context: ParseContext
) {
  const attrs: any = {
    type: 'lottie-shape-ellipse',
    // Should have no fill and stroke by default
    style: {
      fill: 'none',
      stroke: 'none',
    },
    shape: {},
  };

  parseValue(shape.p, attrs, 'shape', ['cx', 'cy'], animations, context);
  parseValue(
    shape.s,
    attrs,
    'shape',
    ['rx', 'ry'],
    animations,
    context,
    (val) => val / 2
  );
  return attrs;
}

function pickKeyframeAnimationsByKeys(
  keyframeAnimations: KeyframeAnimation[],
  keyNames: string[]
) {
  const animationsWithKey: KeyframeAnimation[] = [];
  const animationsWithoutKey: KeyframeAnimation[] = [];

  keyframeAnimations.forEach((kfAnim) => {
    const hasKey = !!kfAnim.keyframes?.find((kf) => {
      return !!keyNames.find((keyName) => kf[keyName] != null);
    });
    if (hasKey) {
      animationsWithKey.push(kfAnim);
    } else {
      animationsWithoutKey.push(kfAnim);
    }
  });

  return [animationsWithKey, animationsWithoutKey];
}

function pickProps(obj: any, keyNames: string[]) {
  const picked: any = {};
  const other: any = {};
  Object.keys(obj).forEach((key) => {
    if (keyNames.indexOf(key) >= 0) {
      picked[key] = obj[key];
    } else {
      other[key] = obj[key];
    }
  });
  return [picked, other];
}

const transformKeys = ['x', 'y', 'scaleX', 'scaleY', 'rotation'];
function createNewGroupForAnchor(el: CustomElementOption) {
  const keyframeAnimations = el.keyframeAnimation;
  const [anchorAnimations, otherAnimtions] = pickKeyframeAnimationsByKeys(
    keyframeAnimations || [],
    ['anchorX', 'anchorY']
  );
  const anchorX = (el as any).anchorX;
  const anchorY = (el as any).anchorY;
  // echarts doesn't have anchor transform. Use a separate group.
  if (anchorX || anchorY || anchorAnimations.length) {
    const [transformAnimations, nonTransformAnimations] =
      pickKeyframeAnimationsByKeys(otherAnimtions, transformKeys);
    const [transformAttrs, nonTransformAttrs] = pickProps(el, transformKeys);

    const dummy = nonTransformAttrs as CustomElementOption;
    el = {
      type: 'group',
      children: [dummy],
      ...transformAttrs,
    };
    dummy.x = -anchorX || 0;
    dummy.y = -anchorY || 0;

    if (nonTransformAnimations.length || anchorAnimations.length) {
      anchorAnimations.forEach((anim) => {
        anim.keyframes?.forEach((kf) => {
          if (kf.anchorX) {
            kf.x = -anchorX;
            delete kf.anchorX;
          }
          if (kf.anchorY) {
            kf.y = -anchorY;
            delete kf.anchorY;
          }
        });
      });
      dummy.keyframeAnimation = [
        ...nonTransformAnimations,
        ...anchorAnimations,
      ];
    } else {
      dummy.keyframeAnimation = undefined;
    }

    if (transformAnimations.length) {
      el.keyframeAnimation = transformAnimations;
    }
    return el;
  }

  return el;
}

function parseShapeLayer(layer: Lottie.ShapeLayer, context: ParseContext) {
  function tryCreateShape(
    shape: Lottie.ShapeElement,
    keyframeAnimations: KeyframeAnimation[]
  ) {
    let ecEl: any;
    switch (shape.ty) {
      case Lottie.ShapeType.Path:
        ecEl = parseShapePaths(
          shape as Lottie.PathShape,
          keyframeAnimations,
          context
        );
        break;
      case Lottie.ShapeType.Ellipse:
        ecEl = parseShapeEllipse(
          shape as Lottie.EllipseShape,
          keyframeAnimations,
          context
        );
        break;
      case Lottie.ShapeType.Rect:
        ecEl = parseShapeRect(
          shape as Lottie.RectShape,
          keyframeAnimations,
          context
        );
        break;
    }
    return ecEl;
  }

  function parseIterations(shapes: Lottie.ShapeElement[]) {
    const ecEls: any[] = [];
    const attrs: Record<string, any> = {};
    const keyframeAnimations: KeyframeAnimation[] = [];
    // Order is reversed
    shapes = shapes.slice().reverse();
    shapes.forEach((shape) => {
      let ecEl;
      switch (shape.ty) {
        case Lottie.ShapeType.Group:
          ecEl = {
            type: 'group',
            children: parseIterations((shape as Lottie.GroupShapeElement).it),
          };
          break;
        // TODO Multiple fill and stroke
        case Lottie.ShapeType.Fill:
          parseFill(
            shape as Lottie.FillShape,
            attrs,
            keyframeAnimations,
            context
          );
          break;
        case Lottie.ShapeType.Stroke:
          parseStroke(
            shape as Lottie.StrokeShape,
            attrs,
            keyframeAnimations,
            context
          );
          break;
        case Lottie.ShapeType.Transform:
          parseTransforms(
            shape as Lottie.TransformShape,
            attrs,
            keyframeAnimations,
            context
          );
          break;
        // TODO Multiple shapes.
        default:
          ecEl = tryCreateShape(shape, keyframeAnimations);
      }
      if (ecEl) {
        ecEl.name = shape.nm;
        ecEls.push(ecEl);
      }
    });

    ecEls.forEach((el, idx) => {
      util.merge(el, attrs, true);
      if (keyframeAnimations.length) {
        el.keyframeAnimation = keyframeAnimations;
      }

      ecEls[idx] = createNewGroupForAnchor(el);
    });
    return ecEls;
  }

  const layerGroup: CustomElementOption = {
    type: 'group',
    children: parseIterations(layer.shapes),
  };
  return createNewGroupForAnchor(layerGroup);
}

function parseLayers(layers: Lottie.Layer[], context: ParseContext) {
  let elements: any[] = [];

  // Order is reversed
  layers = layers.slice().reverse();
  const layerIndexMap: Record<number, CustomElementOption> = {};
  layers?.forEach((layer) => {
    let layerGroup;
    switch (layer.ty) {
      case Lottie.LayerType.shape:
        layerGroup = parseShapeLayer(layer as Lottie.ShapeLayer, context);
        break;
      case Lottie.LayerType.null:
        layerGroup = {
          type: 'group',
          children: [],
        };
    }

    if (layerGroup) {
      const keyframeAnimations: KeyframeAnimation[] = [];
      const attrs: Record<string, any> = {
        name: layer.nm,
      };
      parseTransforms(layer.ks, attrs, keyframeAnimations, context);

      if (keyframeAnimations.length) {
        layerGroup.keyframeAnimation = keyframeAnimations;
      }
      Object.assign(layerGroup, attrs);
      if (layer.ind != null) {
        layerIndexMap[layer.ind] = layerGroup;
      }
      elements.push(
        Object.assign(createNewGroupForAnchor(layerGroup), {
          extra: {
            layerParent: layer.parent,
          },
        })
      );
    }
  });

  // Build hierarchy
  return elements.filter((el) => {
    const parentLayer = layerIndexMap[el.extra.layerParent];
    if (parentLayer) {
      // Has anchor
      parentLayer.children?.push(el);
      return false;
    }
    return true;
  });
}

export function parse(data: Lottie.Animation) {
  completeData(data);
  const context = new ParseContext();

  context.frameTime = 1000 / (data.fr || 30);
  context.startFrame = data.ip;
  context.endFrame = data.op;

  data.assets?.forEach((asset) => {});

  const elements = parseLayers(data.layers || [], context);

  return {
    width: data.w,
    height: data.h,
    elements,
  };
}

export { install };
