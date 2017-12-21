const gulp = require('gulp');
const babel = require('gulp-babel');
const browserSync = require('browser-sync').create();
const historyApiFallback = require('connect-history-api-fallback');
const concat = require('gulp-concat');
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
    'node_modules/sigma/build/sigma.require.js',
    'node_modules/sigma/build/plugins/sigma.layout.forceAtlas2.min.js',
    'node_modules/sigma/build/plugins/sigma.plugins.dragNodes.min.js',
    'node_modules/sigma/build/plugins/sigma.plugins.animate.min.js',
    'node_modules/d3/d3.min.js',
    'node_modules/crossfilter2/crossfilter.min.js',
    'node_modules/dc/dc.css',
    'node_modules/dc/dc.js',
    'node_modules/qtip2/dist/jquery.qtip.css',
    'node_modules/qtip2/dist/jquery.qtip.js',
    'src/style.css'
  ])
  .pipe(gulp.dest('dist/vendor'));
  
  gulp.src([
    'data/example-3276.json',
    'data/example.json'
  ])
  .pipe(gulp.dest('dist/data'));
  
  gulp.src([
    'src/fonts/*',
    'node_modules/bootstrap/fonts/*'
  ])
  .pipe(gulp.dest('fonts'));
});

gulp.task('html', () => {
  gulp.src('src/**/*.html')
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
});

// build task
gulp.task('build', ['copy', 'html', 'transpile']);

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
