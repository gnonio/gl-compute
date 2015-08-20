precision highp float;

// Base
varying vec2 uv;

void main() {

	// Setup auxiliary indexes
	/*int m = int( floor( uv.x * float( shape.x ) ) ); int x = m;	// COL	
	int n = int( floor( uv.y * float( shape.y ) ) ); int y = n;	// ROW | UNFLIPPED
	int nf = shape.y - n - 1;										// 	   | FLIPPED
	
	int pos = n * int( shape.x ) + m; 		// INDEX = ARRAY INPUT | UNFLIPPED - BOTTOM LEFT 	| ROW-MJ
	int posf = nf * int( shape.x ) + m; 	// 					   | FLIPPED - TOP LEFT 		| ROW-MJ
	//int idx = x * int( stageShape.y ) + y;
	
	float stepx = 1.0 / float( shape.x );
	float xx = float( m ) * stepx + stepx * 0.5;
	
	float stepy = 1.0 / float( shape.y );
	float yy = float( n ) * stepy + stepy * 0.5;

	float c1 = float( pos ) * 0.05;*/

	/*if ( computeLoop == 0 ) {
		gl_FragColor = result1;
	} else {
		gl_FragColor = last;
	}*/
	//gl_FragColor = last;//texture2D( result, vec2(uv.x, uv.y) );
	
	vec4 test = texture2D( StageA, vec2(uv.x, uv.y) ) * 0.5;
	test.a = 1.0;
	gl_FragColor = test;
	//gl_FragColor = vec4( yy, uv.y, uv.y, 1.0); // * float( dataCShape.x )
	//gl_FragColor = vec4( float( computeLoop ) / 10.0, 0.0, 0.0, 1.0 );
}