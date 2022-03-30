const gulp = require('gulp');
const rename = require('gulp-rename');
const sourcemaps = require('gulp-sourcemaps');
const sass = require('gulp-sass')(require('sass'));
const run = require('gulp-run');
const nodemon = require('gulp-nodemon'); 

gulp.task('sass', function() {
    return gulp
        .src([
            'node_modules/bootstrap/scss/bootstrap.scss',
            'public/scss/*.scss'
        ])
        .pipe(sourcemaps.init())
        .pipe(
            sass({
                sourcemap: true,
                style: "compressed"
            }).on("error", sass.logError)
        )
        .pipe(sourcemaps.write())
        .pipe(gulp.dest('public/css'));
});

// Copy alle external JavaScript libraries into the public js folder
gulp.task('js', function() {
    return gulp
        .src([
            'node_modules/jquery/dist/jquery.min.js', 
            'node_modules/jquery-ui-dist/jquery-ui.min.js',
            'node_modules/bootstrap/dist/js/bootstrap.bundle.min.js',
            'node_modules/vis-network/standalone/umd/vis-network.min.js',
            'node_modules/nouislider/distribute/nouislider.min.js',
            'node_modules/wnumb/wNumb.min.js'
        ])
        .pipe(gulp.dest('public/js'));
});

// Copy all external CSS into the public css folder
gulp.task('css', function() {
    return gulp.src([
            'node_modules/jquery-ui-dist/jquery-ui.min.css',
            'node_modules/nouislider/distribute/nouislider.min.css'
        ])
        .pipe(gulp.dest('public/css'));
});

// Copy fontawesome icons into the public css folder
gulp.task('fontawesome', function() {
    return gulp.src([
            'node_modules/@fortawesome/fontawesome-free/js/all.js'
        ])
        .pipe(rename(function (path) {
            path.basename = 'fontawesome-all'
        }))
        .pipe(gulp.dest('public/js'));
});

// Run nodemon
gulp.task('nodemon', function() {
    nodemon({
        script: 'server.js',
        ext: 'js',
        ignore: ['dist/']
    })
    .on('restart', function() {
        console.log('>> node restart');
    })
});

gulp.watch(['public/scss/*.scss', 'public/scss/modules/*.scss'], gulp.series('sass'));

// Run server
gulp.task('server', function() {
    run('node server.js', {verbosity: 3}).exec();    
})

let build = gulp.series(gulp.parallel('js', 'css', 'sass', 'fontawesome'), 'server');

gulp.task('default', build);