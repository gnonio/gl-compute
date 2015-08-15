precision highp float;

// Base
varying vec2 uv;

void main() {

	// Setup auxiliary indexes
	int m = int( floor( uv.x * float( stageShape.x ) ) ); int x = m;	// COL	
	int n = int( floor( uv.y * float( stageShape.y ) ) ); int y = n;	// ROW | UNFLIPPED
	int nf = stageShape.y - n - 1;										// 	   | FLIPPED
	
	int pos = n * int( stageShape.x ) + m; 		// INDEX = ARRAY INPUT | UNFLIPPED - BOTTOM LEFT 	| ROW-MJ
	int posf = nf * int( stageShape.x ) + m; 	// 					   | FLIPPED - TOP LEFT 		| ROW-MJ
	//int idx = x * int( stageShape.y ) + y;
	
	float stepx = 1.0 / float( stageShape.x );
	float xx = float( m ) * stepx + stepx * 0.5;
	
	float stepy = 1.0 / float( stageShape.y );
	float yy = float( n ) * stepy + stepy * 0.5;

	float c1 = float( pos ) * 0.05;
	
	vec4 result1 = texture2D( dataA, vec2(uv.x, uv.y) );
	vec4 result2 = texture2D( StageB, vec2(uv.x, uv.y) );
	vec4 result3 = vec4( float( computeLoop ) / 10.0, 0.0, 0.0, 1.0 );
	vec4 last;
	if ( computeLoop == 0 ) {
		last = result1;
	} else {
		last = result2;
	}
	//gl_FragColor = vec4( float( computeLoop ), 0.0, 0.0, 1.0 );
	//gl_FragColor = texture2D( result, vec2(uv.x, uv.y) );
	gl_FragColor = last;
	//gl_FragColor = vec4( yy, uv.y, uv.y, 1.0); // * float( dataCShape.x )
}

// These comments are VALID ONLY when using ndarrays

// COLUMN-MAJOR ORDER OpenGL | INDEX aligned with framebuffers pixel scan order (bottom left)
/*
		•--•--•--•--•
    y 2 | 2| 5| 8|11|	= [ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 ]
		•--•--•--•--•		^ Implied Data input order via array
    y 1 | 1| 4| 7|10|
		•--•--•--•--•	> idx 	[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 ]
    y 0 | 0| 3| 6| 9|	> pos	[ 2, 5, 8, 11, 1, 4, 7, 10, 0, 3, 6, 9 ]
		•--•--•--•--•			  ^ Data output order via gl.readPixels()
	  x   0  1  2  3
	
*/

// ROW-MAJOR ORDER Math | VIRTUAL index aligned with visual reading order (top left) | SET on-demand with: setVisualOrder();
/*
	col   0  1  2  3
		•--•--•--•--•
  row 0 | 0| 1| 2| 3|	= [ 8, 4, 0, 9, 5, 1, 10, 6, 2, 11, 7, 3 ]
		•--•--•--•--•		^ Implied Data input order via array
  row 1 | 4| 5| 6| 7|
		•--•--•--•--•	> idx 	[ 8, 4, 0, 9, 5, 1, 10, 6, 2, 11, 7, 3 ]
  row 2 | 8| 9|10|11|	> pos	[ 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11 ]
		•--•--•--•--•			  ^ Data output order via gl.readPixels()
	
*/

/*
	Adopting:
		x, y, idx, width, height	to denote references under OpenGL context
		n, m, pos,  cols,   rows	to denote references under Math/Visual context

	Preferably data arrives as is and is processed as is.
	To avoid extra processing we can temporarily assume Math/Visual use OpenGL dispositions
	by switching Rows and Columns into Heights and Widths respectively.
	Yet if switching is not practical, or we need the results in a Math/Visual dispositions
	conversions should generally still occur within the shader.
	
	( ie.	2 Rows BY 3 Cols Matrix
			2 Cols BY 3 Rows Texture
		  = 2 Xs   BY 3 Ys   Texture	as if rotated 90 deg CCW )
			
			
	Matrix multiplication:	
	(2x3) dot (3x2 or 3x1 Vector)		(3x2) dot (2x3 or 1x3 Vector)

			Math							OpenGL

								>		•--•--•--•	•--•--•
				•--•	--•		>		| 8| 6| 4|	| x| x|
				| 9|	 8|		>
				•--•	--•		>		•--•--•--•	•--•--•
				| 7|	 6|		>		| 9| 7| 5|	| x| x|
				•--•	--•		>		•--•--•--•	•--•--•
				| 5|	 4|		>
				•--•	--•		>					•--•--•
								>					| 3| 6|
	•--•--•--•	•--•	--•		>	ROTATE			•--•--•
	| 1| 2| 3|	| x|	 x|		>	90 Deg			| 2| 5|
	•--•--•--•	•--•	--•		>	 CCW			•--•--•
	| 4| 5| 6|	| x|	 x|		>					| 1| 4|
	•--•--•--•	•--•	--•		>					•--•--•
	
*/