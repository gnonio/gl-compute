precision highp float;

varying vec2 uv;

void main() {
	int x = StageBShape.x;
	int y = StageBShape.y;
	gl_FragColor = texture2D( StageA, vec2(uv.x, 1.0 - uv.y) );//1.0 - 
	//gl_FragColor = vec4( outShape.x, 0, 0, 1 );
}