precision highp float;

// Base
varying vec2 uv;

void main() {
	gl_FragColor = texture2D( StageA, vec2(uv.x, 1.0 - uv.y) ); // Flip Vertically
}