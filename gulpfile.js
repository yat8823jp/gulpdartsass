/*
 * Global variables
 */

const { doesNotMatch } = require('assert');
const { src, dest, watch, series, parallel } = require( 'gulp' );

const postcss          = require( 'gulp-postcss' ),
	autoprefixer     = require( 'autoprefixer' ),
	stylelint        = require( 'stylelint' ),
	sass             = require( 'gulp-dart-sass' ),
	sassGlob         = require( 'gulp-sass-glob-use-forward' ),
	browserSync      = require( 'browser-sync' ).create(),//ブラウザシンク
	plumber          = require( 'gulp-plumber' ),//エラー通知
	notify           = require( 'gulp-notify' ),//エラー通知
	vinylSource      = require( 'vinyl-source-stream' ),
	browserify       = require( 'browserify' ),
	babel            = require( 'gulp-babel' ),
	babelify         = require( 'babelify' ),
	watchify         = require( 'watchify' ),
	uglify           = require( 'gulp-uglify' ),//js圧縮
	rename           = require( 'gulp-rename' ),
	del              = require( 'del' ),//ディレクトリ削除
	debug            = require( 'gulp-debug' ),
	path             = require( 'path' ), //path
	minimist         = require( 'minimist' ),
	cached           = require( 'gulp-cached'),
	fractal          = require( '@frctl/fractal' ).create(),
	imagemin         = require( 'gulp-imagemin' ),
	pngquant         = require( 'imagemin-pngquant' );

	const paths = {
		rootDir   : './',
		srcDir    : { html: './**/*.html', css: './src/styles/**/*.scss', js: './src/scripts/**/*.js', img: './src/images/**/*.{jpg,jpeg,png,svg,gif}' },
		dstDir    : { css: './css', js: './js', img: './images' },
		serverDir : 'localhost',
		styleguide: { base: './src/styleguide', css: './src/styles/**/*.scss', js: './src/scripts/**/*.js', img: './src/images/**/*.{jpg,jpeg,png,svg,gif}', watch: './src/**/*' },
	};

	const options = minimist( process.argv.slice( 2 ), {
		string: 'path',
		default: {
			path: 'themrish.local' // 引数の初期値
		}
	});

	fractal.set( 'project.title', 'Style guide' );
	fractal.components.set( 'path', './src/styleguide/' );
	fractal.docs.set('path', './src/styleguide/docs' );
	fractal.web.set( 'builder.dest', './styleguide' );
	const logger = fractal.cli.console;

	const browsers = [
		'last 2 versions',
		'> 5%',
		'ie = 11',
		'ios >= 8',
		'and_chr >= 5',
		'Android >= 5',
	]

/*
 * Sass
 */
const css = () => {
	return src( paths.srcDir.css, { sourcemaps: true } )
	.pipe( sassGlob() )
	.pipe( sass.sync().on( 'error', sass.logError ) )
	.pipe( cached( 'scss' ) )
	.pipe( sass( {
		outputStyle: 'expanded',
		minifier: true, //圧縮の有無 true/false
		includePaths: ['./src/styles']
	} ) )
	.pipe( postcss( [
		autoprefixer( {
			cascade: false,
			grid: true
		} ),
	] ) )
	.pipe( rename( {
		sass: true
	} ) )
	.pipe( dest( paths.dstDir.css, { sourcemaps: paths.rootDir } ) );
};

/*
 * Style Guide
 */
function styleguideTask() {
	const builder = fractal.web.builder();
	builder.on( 'progress', ( completed, total ) => logger.update( `${total} 件中 ${completed} 件目を出力中...`, 'info' ) );
	builder.on( 'error', err => logger.error( err.message ) );
	return builder.build().then( () => logger.success( 'スタイルガイドの出力処理が完了しました。' ) );
}

const styleguideServer = ( done ) => {
	browserSync.init( styleguideReload );
	done();
}

const styleguideReload = {
	server: './styleguide/',
	notify: false
}

const devcopyComponent = ( done ) => {
	return src([
	'./src/styles/object/component/*.scss'
	], {
		dot: true
	} )
	.pipe( rename ( function ( path ) {
		path.dirname = '/components/' + path.basename.replace( '_', '' );
		path.basename = 'style';
	} ) )
	.pipe( dest( paths.styleguide.base ) );
	done();
};

/*
 * JavaScript
 */

function errorAlert( error ) {
	notify.onError( { title: "Error", message: "Check your terminal", sound: "Funk" } )( error ); //Error Notification
	console.log( error.toString() );//Prints Error to Console
	this.emit( "end" ); //End function
};

const js = () => {
	const option = {
		bundleOption: {
			cache: {}, packageCache: {}, fullPaths: false,
			debug: true,
			entries: './src/scripts/main.js',
			extensions: [ 'js' ]
		},
		dest: paths.dstDir.js,
		filename: 'bundle.js'
	};
	return browserify( option.bundleOption )
	.transform( babelify.configure( {
		compact: false,
		presets: ['@babel/preset-env']
	} ) )
	.bundle()
	.pipe( plumber( { errorHandler: errorAlert } ) )
	.pipe( vinylSource( option.filename ) )
	.pipe( dest ( paths.dstDir.js ) );
}

const imageminOption = [
	pngquant( {
		quality: [.7, .85]
	} ),
	imagemin.gifsicle(),
	imagemin.optipng(),
	imagemin.svgo( {
		removeViewBox: false
	} )
];

const imagemcopy = ( done ) => {
	return src( paths.srcDir.img )
	.pipe( imagemin( imageminOption ) )
	.pipe( dest( paths.dstDir.img ) );
}

const server = ( done ) => {
	browserSync.init( {
		notify: true,
		startPath: '/',
		server: {
			baseDir: paths.rootDir
		}
	} );
	done();
}

const browserSyncOption = {
	proxy: {
	  target: options.domain
	},
	notify: true
}

const reload = ( done ) => {
	browserSync.reload();
	done();
}


// /*
//  * Build
//  */
const clean = ( done ) => {
	return del( [paths.styleguide.base] );
	done();
}
const devcopy = ( done ) => {
	return src([
		paths.srcDir.css,
		paths.srcDir.js,
		'!./src/scripts/main.js',
		'!./src/scripts/config.js',
		'!./src/styles/foundation/*.scss',
		'!./src/styles/style.scss',
	], {
		dot: true
	} )
	.pipe( rename ( function ( path ) {
		path.dirname = '/components/' + path.basename.replace( '_', '' );
		path.basename = 'style';
	} ) )
	.pipe( dest( paths.styleguide.base ) );
	done();
};

const watchFile = ( done ) => {
	watch( paths.srcDir.css, series( css, reload ) );
	watch( paths.srcDir.js , series( js,  reload ) );
	watch( paths.srcDir.html , series( reload ) );
	watch( paths.srcDir.img , series( imagemcopy, reload ) );
	done();
}

const watchStyleguide = ( done ) => {
	watch( paths.srcDir.css, series( css, reload ) );
	watch( paths.srcDir.js , series( js,  reload ) );
	watch( paths.srcDir.img , series( imagemcopy, reload ) );
	done();
}

exports.css = css;
exports.js = js;
exports.imagemcopy = imagemcopy;

exports.clean = clean;
exports.devcopy = series( clean, devcopy, devcopyComponent );
exports.build = series( devcopy, styleguideTask );

exports.default = parallel( css, js, watchFile, server );
exports.styleguide = series(
	parallel( css, js, devcopyComponent, styleguideTask ),
	parallel( watchStyleguide, styleguideServer )
)
