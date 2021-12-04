import * as Lottie from './lottie.type';
import type { ElementProps, DisplayableProps, PathProps } from 'zrender';
import { util } from 'zrender';
import { install } from './installLottieShapes';

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
  kf: Lottie.OffsetKeyframe,
  nextKf: Lottie.OffsetKeyframe,
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

function parseOffsetKeyframe(
  kfs: Lottie.OffsetKeyframe[],
  targetPropName: string,
  propNames: string[],
  keyframeAnimations: KeyframeAnimation[],
  context: ParseContext,
  convertVal?: (val: number) => number
) {
  const kfsLen = kfs.length;
  const start = kfs[0].t;
  const end = kfs[kfsLen - 1].t;
  const duration = end - start;

  // TODO merge if bezier easing is same.
  for (let dimIndex = 0; dimIndex < propNames.length; dimIndex++) {
    const outKeyframes: KeyframeAnimationKeyframe[] = [];
    const propName = propNames[dimIndex];
    for (let i = 0; i < kfsLen; i++) {
      const kf = kfs[i];
      const nextKf = kfs[i + 1];
      const outKeyframe: KeyframeAnimationKeyframe = {
        easing: getMultiDimensionEasingBezierString(kf, nextKf, dimIndex),
        // Frame starts from 1
        percent: (kf.t - 1) / duration,
      };
      // Last keyframe may not have value.
      if (kf.s) {
        let val = getMultiDimensionValue(kf.s, dimIndex);
        if (convertVal) {
          val = convertVal(val);
        }
        (targetPropName
          ? (outKeyframe[targetPropName] = {} as any)
          : outKeyframe)[propName] = val;
      }
      outKeyframes.push(outKeyframe);
    }
    if (outKeyframes.length) {
      keyframeAnimations.push({
        duration: duration * context.frameTime,
        delay: (start - 1) * context.frameTime,
        keyframes: outKeyframes,
      });
    }
  }
}

function parseColorOffsetKeyframe(
  kfs: Lottie.OffsetKeyframe[],
  targetPropName: string,
  propName: string,
  keyframeAnimations: KeyframeAnimation[],
  context: ParseContext
) {
  const kfsLen = kfs.length;
  const start = kfs[0].t;
  const end = kfs[kfsLen - 1].t;
  const duration = end - start;

  const outKeyframes: KeyframeAnimationKeyframe[] = [];

  for (let i = 0; i < kfsLen; i++) {
    const kf = kfs[i];
    const nextKf = kfs[i + 1];
    const outKeyframe: KeyframeAnimationKeyframe = {
      // Only use the first easing. TODO: Different easing?
      easing: getMultiDimensionEasingBezierString(kf, nextKf, 0),
      // Frame starts from 1
      percent: (kf.t - 1) / duration,
    };
    // Last keyframe may not have value.
    if (kf.s) {
      (targetPropName
        ? (outKeyframe[targetPropName] = {} as any)
        : outKeyframe)[propName] = toColorString(kf.s);
    }
    outKeyframes.push(outKeyframe);
  }
  if (outKeyframes.length) {
    keyframeAnimations.push({
      duration: duration * context.frameTime,
      delay: (start - 1) * context.frameTime,
      keyframes: outKeyframes,
    });
  }
}

function parseTransforms(ks: Lottie.Transform, context: ParseContext) {
  const attrs: ElementProps = {};
  const keyframeAnimations: KeyframeAnimation[] = [];

  if (isMultiDimensionalValue(ks.p)) {
    attrs.x = ks.p.k[0];
    attrs.y = ks.p.k[1];
  } else if (isMultiDimensionalKeyframedValue(ks.p)) {
    // TODO Merge dimensions
    parseOffsetKeyframe(ks.p.k, '', ['x', 'y'], keyframeAnimations, context);
  }

  if (isValue(ks.r)) {
    attrs.rotation = (ks.r.k / 180) * Math.PI;
  } else if (isKeyframedValue(ks.r)) {
    parseOffsetKeyframe(
      ks.r.k,
      '',
      ['rotation'],
      keyframeAnimations,
      context,
      (val) => (val / 180) * Math.PI
    );
  }

  if (isMultiDimensionalValue(ks.s)) {
    attrs.scaleX = ks.s.k[0] / 100;
    attrs.scaleY = ks.s.k[1] / 100;
  } else if (isMultiDimensionalKeyframedValue(ks.s)) {
    parseOffsetKeyframe(
      ks.s.k,
      '',
      ['scaleX', 'scaleY'],
      keyframeAnimations,
      context,
      (val) => val / 100
    );
  }

  // TODO opacity.
  // TODO sk: skew, sa: skew axis
  // TODO px, py

  return {
    attrs,
    keyframeAnimations,
  };
}

function parseFill(
  fl: Lottie.FillShape,
  attrs: PathProps,
  keyframeAnimations: KeyframeAnimation[],
  context: ParseContext
) {
  // Color
  if (isMultiDimensionalValue(fl.c)) {
    attrs.style = attrs.style || {};
    attrs.style.fill = toColorString(fl.c.k);
  } else if (isMultiDimensionalKeyframedValue(fl.c)) {
    parseColorOffsetKeyframe(
      fl.c.k,
      'style',
      'fill',
      keyframeAnimations,
      context
    );
  }

  // Opacity
  if (isValue(fl.o)) {
    attrs.style = attrs.style || {};
    attrs.style.fillOpacity = fl.o.k / 100;
  } else if (isKeyframedValue(fl.o)) {
    parseOffsetKeyframe(
      fl.o.k,
      'style',
      ['fillOpacity'],
      keyframeAnimations,
      context,
      (opacity) => opacity / 100
    );
  }
}
function parseStroke(
  st: Lottie.FillShape,
  attrs: PathProps,
  keyframeAnimations: KeyframeAnimation[],
  context: ParseContext
) {}

function isBezier(k: any): k is Lottie.Bezier {
  return k && k.i && k.o && k.v;
}
function parseShapePaths(
  sh: Lottie.ShapeProperty,
  attrs: PathProps,
  keyframeAnimations: KeyframeAnimation[],
  context: ParseContext
) {
  if (isBezier(sh.k)) {
    attrs.shape = {
      in: sh.k.i,
      out: sh.k.o,
      v: sh.k.v,
      close: sh.k.c,
    };
  }
}

function createShapes(layer: Lottie.ShapeLayer, context: ParseContext) {
  function tryCreateShape(
    shape: Lottie.ShapeElement,
    keyframeAnimations: KeyframeAnimation[]
  ) {
    let ecEl: any;
    switch (shape.ty) {
      case Lottie.ShapeType.Path:
        ecEl = {
          type: 'lottie-shape', // Registered lottie shape
        };
        parseShapePaths(
          (shape as Lottie.PathShape).ks,
          ecEl,
          keyframeAnimations,
          context
        );
        break;
      case Lottie.ShapeType.Ellipse:
        ecEl = {
          type: 'ellipse',
        };
        break;
      case Lottie.ShapeType.Rect:
        ecEl = {
          type: 'rect',
        };
        break;
    }
    return ecEl;
  }

  function parseIterations(shapes: Lottie.ShapeElement[]) {
    const ecEls: any[] = [];
    const attrs: Record<string, any> = {};
    const keyframeAnimations: KeyframeAnimation[] = [];
    shapes.forEach((shape) => {
      let ecEl;
      switch (shape.ty) {
        case Lottie.ShapeType.Group:
          ecEl = {
            type: 'group',
            children: parseIterations((shape as Lottie.GroupShapeElement).it),
          };
          break;
        case Lottie.ShapeType.Fill:
          parseFill(
            shape as Lottie.FillShape,
            attrs,
            keyframeAnimations,
            context
          );
          break;
        default:
          ecEl = tryCreateShape(shape);
      }
      if (ecEl) {
        ecEls.push(ecEl);
      }
    });

    ecEls.forEach((el) => {
      util.merge(el, attrs, true);
      el.keyframeAnimation = keyframeAnimations;
    });
    return ecEls;
  }

  const { attrs, keyframeAnimations } = parseTransforms(layer.ks, context);

  return {
    type: 'group',
    ...attrs,
    keyframeAnimation: keyframeAnimations,
    children: parseIterations(layer.shapes),
  };
}

export function parse(data: Lottie.Animation) {
  const context = new ParseContext();

  context.frameTime = 1000 / (data.fr || 30);
  context.startFrame = data.ip;
  context.endFrame = data.op;

  const elements: any[] = [];

  data.layers?.forEach((layer) => {
    switch (layer.ty) {
      case Lottie.LayerType.shape:
        elements.push(createShapes(layer as Lottie.ShapeLayer, context));
    }
  });

  return {
    width: data.w,
    height: data.h,
    elements,
  };
}

export { install };
