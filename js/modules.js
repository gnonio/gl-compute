var getContext 		= require('get-canvas-context')
var glExt 			= require("webglew")
var createFBO 		= require("gl-fbo")
var createShader 	= require('gl-shader')
var createBuffer 	= require("gl-buffer")
var createVAO 		= require("gl-vao")
var createTexture 	= require("gl-texture2d")

stackGL = {
	getContext: 	getContext,
	glExt: 			glExt,
	createFBO: 		createFBO,
	createShader: 	createShader,
	createBuffer: 	createBuffer,
	createVAO: 		createVAO,
	createTexture: 	createTexture
}

var ndarray 		= require("ndarray")

nd = {
	array: ndarray
}