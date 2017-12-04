const gulp = require('gulp');
const babel = require('gulp-babel');
const browserSync = require('browser-sync').create();
const historyApiFallback = require('connect-history-api-fallback');
const concat = require('gulp-concat');
const sass = require('gulp-sass');
const watch = require('gulp-watch');

const karma = require('karma');

gulp.task('transpile', () => {
  return gulp.src(['src/**/*.js', '!src/**/*.spec.js'])
    .pipe(babel({
      presets: ['es2015']
    }))
    .pipe(concat('bundle.js'))
    .pipe(gulp.dest('dist'));
});

gulp.task('copy', () => {
  gulp.src([
    'node_modules/angular/angular.min.js',
    'node_modules/angular-route/angular-route.min.js',
    'node_modules/bootstrap/dist/css/bootstrap.min.css',
    'node_modules/bootstrap/dist/js/bootstrap.min.js',
    'node_modules/jquery/dist/jquery.min.js',
    'node_modules/lodash/lodash.min.js',
    'node_modules/cytoscape/dist/cytoscape.js',
    'node_modules/qtip/qtip.min.js',
    'node_modules/qtip/css/qtip.css',
    'node_modules/qtip/css/theme.css',
    'node_modules/require/require.min.js',
    'node_modules/typeahead/typeahead.js',
    'node_modules/cytoscape-cose-bilkent/cytoscape-cose-bilkent.js',
    'node_modules/weaverjs/dist/weaver.js',
    'node_modules/cytoscape-spread/cytoscape-spread.js',
    'node_modules/webcola/WebCola/cola.min.js',
    'node_modules/cytoscape-cola/cytoscape-cola.js',
    'node_modules/dagre/dist/dagre.min.js',
    'node_modules/cytoscape-dagre/cytoscape-dagre.js'
  ])
  .pipe(gulp.dest('dist/vendor'));
    gulp.src([
      'data/example-3276.json',
      'data/example.json'
    ])
    .pipe(gulp.dest('dist/data'));

  gulp.src([
    'sample-data.json'
  ])
  .pipe(gulp.dest('dist/api'));

  gulp.src([
    'node_modules/bootstrap/fonts/*'
  ])
  .pipe(gulp.dest('dist/fonts'));
});

gulp.task('html', () => {
  gulp.src('src/**/*.html')
  .pipe(gulp.dest('dist'));
});

gulp.task('sass', () => {
  return gulp.src('src/**/*.scss')
    .pipe(sass().on('error', sass.logError))
    .pipe(concat('style.css'))
    .pipe(gulp.dest('dist'));
});

gulp.task('watch', () => {
  watch('src/**/*.js', () => {
    gulp.start('transpile');
    browserSync.reload();
  });

  watch('src/**/*.html', () => {
    gulp.start('html');
    browserSync.reload();
  });

  watch('src/**/*.scss', () => {
    gulp.start('sass');
    browserSync.reload();
  });
});

// build task
gulp.task('build', ['copy', 'html', 'sass', 'transpile']);

// server
gulp.task('serve', ['build', 'watch'], () => {
  browserSync.init({
      server: {
          baseDir: './dist',
      },
      middleware : [historyApiFallback()]
  });
});

// unit testing
gulp.task('test', (done) => {
  const Server = karma.Server;
  return new Server({
    configFile: __dirname + '/karma.conf.js',
    singleRun: true
  }, done).start();
});
