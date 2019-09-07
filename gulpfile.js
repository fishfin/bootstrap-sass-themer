/*!
 * Gulp automation for Bootstrap (v3, v4) SASS development, also supports
 *   non-Bootstrap SCSS development
 * fishfin (https://github.com/fishfin), 2019
 * Licensed under the MIT license
 */

/* -----------------------------------------------------------------------------
 * General Developer Notes:
 *  1) JS doesn't have static variables. Instead of defining global variables,
 *     you could do the following:
 *     function myFunc() {
 *       if (myFunc.staticVar === undefined) {
 *         myFunc.staticVar = true     // no longer undefined
 *         ...                         // do something for the first invocation
 *       }
 *     }
 *  2) Gulp v4 has breaking changes!
 *     A task in Gulp may contain asynchronous code, for which the code needs to
 *     signal Gulp when the task finished executing. In Gulp v3, you could get
 *     away without doing this. If you didn't explicitly signal async completion,
 *     Gulp would just assume that your task is synchronous and that it is
 *     finished as soon as the task function returns. Gulp v4 is stricter, you
 *     have to explicitly signal task completion, by returning one of the six
 *     types: stream, promise, event emitter, child process, observable or
 *     error-first callback. This gulpfile primarily uses error-first callback.
 *     You can read more here:
 *     https://gulpjs.com/docs/en/getting-started/async-completion
 *     https://stackoverflow.com/questions/36897877/gulp-error-the-following-tasks-did-not-complete-did-you-forget-to-signal-async
 *  3) This gulpfile uses gulp-notify for toaster notifications. You can see
 *     advanced examples here:
 *     https://github.com/mikaelbr/gulp-notify/blob/master/examples/gulpfile.js
 * -----------------------------------------------------------------------------
 */

const pkg = {
  'this'        : require('./package.json'),
  'autoprefixer': require('autoprefixer'),        // auto vendor prefixes i.e. transform to -webkit-transform, -ms-transform, etc.
  'beeper'      : require('beeper'),              // makes the terminal beep
  'colors'      : require('colors'),              // colors to console, provides additional String.prototype
  'concat'      : require('gulp-concat'),         // concatenate files into one
  'del'         : require('del'),                 // to delete directories and files
  'fs'          : require('fs'),                  // interact with file system, e.g. file exists etc. does not require entry in package.json
  'gulp'        : require('gulp'),                // automation engine
  'if'          : require('gulp-if'),             // useful condition checking in gulp
  'imagemin'    : require('gulp-imagemin'),       // optimize images (png, jpg, jpeg, gif
  'livereload'  : require('gulp-livereload'),     // aumatically reloads browser when any of source files changes
  'notify'      : require('gulp-notify'),         // sends messages to Mac Notification Center, Linux notifications or Win8+
  'path'        : require('path'),                // utilities to work with files and directories
  'plumber'     : require('gulp-plumber'),        // removes standard onerror handler on error event, which unpipes streams on error by default
  'postcss'     : require('gulp-postcss'),        // pipe CSS through several plugins, but parse CSS only once, currently only autoprefixer used
  'replace'     : require('gulp-replace'),        // replace string in file
  'sass'        : require('gulp-sass'),           // sass-preprocessor
  'sourcemaps'  : require('gulp-sourcemaps'),     // inline source map in source files, helpful in debugging
  'minifyjs'    : require('gulp-uglify'),         // minify js
  'yargs'       : require('yargs'),               // parse command line arguments
}

const onError = function (err) {
  //log.err(err.toString());
  //pkg.notify.logLevel(0);
  pkg.notify.onError({                            // send pretty notification on error
    appID: pkg.this.name,
    message: err.toString(),
    title: pkg.this.name,
  })(err);
  pkg.beeper();
};
		  
const argv = new pkg.yargs
    .option('B', {alias: 'beep', default: false, type: 'boolean'})
    .option('D', {alias: 'dev', default: false, type: 'boolean'})
    .option('V', {alias: 'verbose', default: false, type: 'boolean'})
    .option('m', {alias: 'sourcemap', default: false, type: 'boolean'})
    .option('t', {alias: 'style', default: '', type: 'string'})
    .option('s', {alias: 'scssdir', default: '', type: 'string'})
    .option('c', {alias: 'cssdir', default:'', type: 'string'})
    .option('e', {alias: 'scssfiles', default:'', type: 'string'})
    .option('r', {alias: 'livereload', default:'', type: 'string'})
    .option('i', {alias: 'imagemin', default:'', type: 'string'})
    .option('j', {alias: 'minifyjss', default:'', type: 'string'})
    .option('k', {alias: 'minifyjsd', default:'', type: 'string'})
    .option('l', {alias: 'minifyjsf', default:'', type: 'string'})
    .argv;

/* -----------------------------------------------------------------------------
 * Writes a log message to console with time or user defined prefix.
 * -----------------------------------------------------------------------------
 */
class Log {
  constructor(prefix='', beep=false, verbose=false) {
    this.prefix = prefix.toString();
    if (this.prefix !== '') {
      this.prefix = _fitLength(this.prefix.toUpperCase(), 8, ' ', true);
    }
    this.beep = (beep ? '\x07' : '');
    this.verbose = verbose;
  }
  log(text, color='', type='', indent=0, beep=false, prefix='') {
    if (Array.isArray(text)) {
      for (var idx in text) {
        this.log(text[idx], color, type, indent, beep, prefix);
      }
    } else if (type !== 'd' || this.verbose) {
      switch (type) {
        case 'w':
          type = 'WRN '.yellow;
          break;
        case 'e':
          type = 'ERR '.red;
          break;
        case 'd':
          type = 'DBG '.grey;
          break;
        default:
          type = '';
      }
      console.log('['.white
          + (prefix === ''
              ? (this.prefix === '' ? _getTime() : this.prefix)
              : _fitLength(prefix.toUpperCase(),8, ' ', true)).stripColors.grey
          + '] '.white
          + type
          + ' '.repeat(indent)
          + (color==='' ? text : text.stripColors[color])
          + (beep ? this.beep : ''));
    }
    return this;
  }
  dbg(text, color='grey', indent=0, beep=false) {
    return this.log(text, (color === '' ? 'grey' : color), 'd', indent, beep);
  }
  inf(text, color='white', indent=0, beep=false) {
    return this.log(text, (color === '' ? 'white' : color), '', indent, beep);
  }
  wrn(text, color='yellow', indent=0, beep=false) {
    return this.log(text, (color === '' ? 'yellow' : color), 'w', indent, beep);
  }
  err(text, color='red', indent=0, beep=false) {
    return this.log(text, (color === '' ? 'red' : color), 'e', indent, beep);
  }
  don(text) {
    return this.log((text.toUpperCase() + ' Done'), 'yellow', '', 0, true);
  }
  sep(text='', char='=', length=69) {
    return this.log(char.repeat(2).white
        + text.toUpperCase().green
        + char.repeat(length - 2 - text.length).white);
  }
  ter(text, indent=0) {
    this.err(text, '', indent, true);
    this.err('Use \'gulp usage\' for help', '', indent, true);
    this.err('You can ignore the \'async completion\' error below', '', indent, true);
    //throw new CustomException('This program will now abort');
    process.exit(-1);
  }
}

/* -----------------------------------------------------------------------------
 * Scss class that takes care of all scss processing
 * -----------------------------------------------------------------------------
 */
class Scss {
  constructor(dev=false, style='compressed', sourcemap=false
              , scssdir='', cssdir='', scssfiles=''
              , verbose=false) {
    this.dev = dev;
    this.verbose = verbose;
    this.scssdir = this.cssdir = '';
    this.scssfiles = [];
    this.scssfilepaths = [];
    this.templatedir = '';
    this.cssfiles = '';
    this.themeimagedir = '';

    var referencedir = '';

    if (scssdir === '' && cssdir === '') {
      log.err('Insufficient arguments, cannot proceed')
         .ter('Use -d, -t or -s, -c');
    }

    if (scssdir !== '') {
      if (!_isValidPath(scssdir, 'd')) {
        log.ter('SCSS directory \'' + scssdir + '\' is not valid');
      } else {
        this.scssdir = scssdir;
        referencedir = pkg.path.join(this.scssdir, '..');
      }
      if (cssdir === '') {
        log.inf('CSS directory not known, trying to locate...');
        var cssdir_try = [
            pkg.path.join(this.scssdir, '..', 'css'),
            pkg.path.join(this.scssdir, 'css'),
        ];
        for (var idx in cssdir_try) {
          log.inf('Checking CSS directory ' + cssdir_try[idx]);
          if (_isValidPath(cssdir_try[idx], 'd')) {
            this.cssdir = cssdir_try[idx];
            break;
          }
        }
        if (this.cssdir === '') {
          log.ter('Provide valid CSS directory');
        }
      }
    }
    if (cssdir !== '') {
      if (!_isValidPath(cssdir, 'd')) {
        log.ter('CSS directory \'' + cssdir + '\' is not valid');
      } else {
        this.cssdir = cssdir;
        referencedir = pkg.path.join(this.cssdir, '..');
      }
      if (scssdir === '') {
        log.inf('SCSS directory not known, trying to locate...');
        var scssdir_try = [
          pkg.path.join(this.cssdir, '..', 'scss'),
          pkg.path.join(this.cssdir, 'scss'),
        ];
        for (var idx in scssdir_try) {
          log.inf('Checking SCSS directory ' + scssdir_try[idx]);
          if (_isValidPath(scssdir_try[idx], 'd')) {
            this.scssdir = scssdir_try[idx];
            break;
          }
        }
        if (this.scssdir === '') {
          log.ter('Provide valid SCSS directory');
        }
      }
    }

    this.cssfiles = pkg.path.join(this.cssdir, '*.css');

    scssfiles = (scssfiles === '' ? ['style.scss'] : scssfiles.split(','));
    for (var idx in scssfiles) {
      var scssfilepath = pkg.path.join(this.scssdir, scssfiles[idx]);
      if (_isValidPath(scssfilepath, 'f')) {
        this.scssfiles.push(scssfiles[idx]);
        this.scssfilepaths.push(scssfilepath);
      } else {
        log.ter('SCSS file \'' + scssfilepath + '\' is invalid', 0, true);
      }
    }

    this.style = (style === '')
        ? (this.dev ? 'expanded' : 'compressed') : style.toLowerCase();
    if (!['compact', 'compressed', 'expanded', 'nested'].includes(this.style)) {
      log.ter('SCSS Style ' + style + ' is invalid');
    }
    this.sourcemap = (sourcemap || this.dev);
    log.sep(' scss-config > ')
       .inf('Build For           : ' + (this.dev ? 'Development' : 'Production'))
       .inf('SCSS Dir            : ' + this.scssdir)
       .inf('SCSS Files (Watch)  : ' + pkg.path.join('**', '*.scss'))
       .inf('SCSS Files (Process): ' + this.scssfiles)
       .inf('CSS Dir             : ' + this.cssdir)
       .inf('Source Map          : ' + (this.sourcemap ? 'Generate' : 'Remove'))
       .inf('CSS Style           : ' + this.style)
       .sep(' < scss-config ');
    return this;
  }

  clean() {
    var sourceMapFilePattern = pkg.path.join(this.cssdir, '*.map');
    log.inf('Removing maps ' + sourceMapFilePattern);
    pkg.del.sync([sourceMapFilePattern], {force: true});
    log.don('scss-clean');
    return this;
  }

  /* ---------------------------------------------------------------------------
   * This task creates CSS from one single core SCSS file. It first runs the
   * scss-clean task to remove the Sourcemaps, then based on flags, creates new
   * Sourcemap (or not), then runs the scss preprocessor. This task does not
   * watch any files, that job is done by other task scss-watch.
   * ---------------------------------------------------------------------------
   */
  preprocess() {
    pkg.gulp.src(this.scssfilepaths)                               // concerned only with one single file - style.scss
        .pipe(pkg.plumber({errorHandler: onError}))
        .pipe(pkg.if(this.sourcemap, pkg.sourcemaps.init()))        // create sourcemaps only parameter set
        .pipe(pkg.sass({outputStyle: this.style}).on('error', pkg.sass.logError))
        .pipe(pkg.postcss([pkg.autoprefixer('last 2 version', 'safari 5', 'ie 7', 'ie 8', 'ie 9', 'opera 12.1', 'ios 6', 'android 4')]))
        .pipe(pkg.if(this.sourcemap, pkg.sourcemaps.write('./')))   // write sourcemap only if dev build
        .pipe(pkg.gulp.dest(this.cssdir))
		.pipe(pkg.gulp.src(['srcx/test.html']))
		.pipe(pkg.replace('foo', 'bar'))
		.pipe(pkg.gulp.dest('./'))
        .on('end', function () {log.don('scss-preprocess');});
        //.pipe(pkg.notify({title: 'aalap', message: 'mess'}));
    return this;
  }

  watch() {
    var scssFilePattern = pkg.path.normalize(this.scssdir + '/**/*.scss');
    log.sep(' scsswatch > ')
       .inf('Watching for SCSS changes:')
       .inf(scssFilePattern, '', 2)
       .sep(' < scsswatch ');

    const watcher = pkg.gulp.watch(scssFilePattern.replace(/\\/g, '/'), scsspreprocess); // bug in Gulp v4.0.2, does not watch windows file path
    
    watcher
      //.on('raw', function (event, path, details) { log.inf('Raw event info: ' + event + path + details); })
      .on('add', function (path, stats) { log.inf(`File ${path} was added`); })
      .on('change', function (path, stats) { log.inf(`File ${path} was changed`); })
      .on('unlink', function (path, stats) { log.inf(`File ${path} was removed`); });
    //watcher.close();

    return this;
  }
}

class ItemArray {
  constructor(items=[], filedelim=',', verbose=false) {
    this.items = [];
    this.filedelim = filedelim;
    this.add(items);
    return this;
  }
  add(items) {
    if (!Array.isArray(items)
        && items.indexOf(this.filedelim) >= 0) {
      items = items.split(this.filedelim);
    }
    if (Array.isArray(items)) {
      for (var idx in items) {
        this.add(items[idx]);
      }
    } else if ((items = items.trim()) !== '') {
      this.remove(items);
      this.items.push(items);
    }
    return this;
  }
  remove(items) {
    if (!Array.isArray(items)
        && items.indexOf(this.filedelim) >= 0) {
      items = items.split(this.filedelim);
    }
    if (Array.isArray(items)) {
      for (var idx in items) {
        this.remove(items[idx]);
      }
    } else if ((items = items.trim()) !== '') {
      for (var idx in this.items) {
        if (items.trim === this.items[idx]) {
          this.items.splice(idx, 1);
        }
      }
    }
    return this;
  }
}

function CustomException(message, metadata='') {
  const error = new Error(message);
  error.code = 'FF_ABORT';
  if (metadata !== '') {
    error.metadata = metadata;
  }
  return error;
}
CustomException.prototype = Object.create(Error.prototype);

/* -----------------------------------------------------------------------------
 * Gets current time.
 * -----------------------------------------------------------------------------
 */
function _getTime() {
  now = new Date();
  return _fitLength(now.getHours(), 2, '0') + ':'
      + _fitLength(now.getMinutes(), 2, '0') + ':'
      + _fitLength(now.getSeconds(), 2, '0');
};

function _imagemin() {
  var srcdirs = new ItemArray(argv.imagemin);
  var srcfiles = new ItemArray();

  if (srcdirs.items.length === 0) {
    log.wrn('No image directories to minify')
       .wrn('Did you miss the parameter to add image directories?');
    return;
  }

  for (idx in srcdirs.items) {
    if (!_isValidPath(srcdirs.items[idx], 'd')) {
      log.ter('Image directory \'' + srcdirs.items[idx] + '\' is invalid', 0, true);
    }
    srcfiles.add(pkg.path.join(srcdirs.items[idx], '**', '*'));
  }

  log.sep(' imagemin-config > ')
     .inf('Image Directories:')
     .inf(srcfiles.items, '', 2)
     .sep(' < imagemin-config ');

  for (idx in srcdirs.items) {
    pkg.gulp.src(srcfiles.items[idx])
        .pipe(pkg.plumber({errorHandler: onError}))
        .pipe(pkg.imagemin([
          pkg.imagemin.gifsicle({interlaced: true}),
          pkg.imagemin.jpegtran({progressive: true}),
          pkg.imagemin.optipng({optimizationLevel: 5}),
          pkg.imagemin.svgo({
            plugins: [{removeViewBox: true}]}),]))
        .pipe(pkg.gulp.dest(srcdirs.items[idx]));
//        .on('end', function () {log.inf('Processed ' + srcdirs.items[idx]);});
  }
  log.don('imagemin');
}

/* -----------------------------------------------------------------------------
 * Checks if a path is a valid directory or file, type can be 'd'|'f'
 * (case-insensitive).
 * -----------------------------------------------------------------------------
 */
function _isValidPath(path, type='d') {
  var isValidPath = false;
  type = type.toLowerCase();
  //if (pkg.fs.existsSync(path)) {
  try {                   // if the path doesn't exist, statSync throws an error
    var stats = pkg.fs.statSync(path);
    if ((type == 'd' && stats.isDirectory()) || (type == 'f' && stats.isFile())) {
      isValidPath = true;
    }
  } catch(err) {}
  //}
  return isValidPath;
}

/* -----------------------------------------------------------------------------
 * Fixes length of input text string to specific value. If input text is
 * smaller, adds directional padding, else substrings
 * -----------------------------------------------------------------------------
 */
function _fitLength(text, targetLength, padChar=' ', padRight=false) {
  text = text.toString();
  padChar = padChar.toString();
  padLength = targetLength - text.length;
  if (padLength > 0) {
    padChars = padChar.repeat(Math.ceil(padLength/padChar.length));
    padChars = padChars.substr(padRight ? 0 : (padChars.length - padLength), padLength);
    text = (padRight ? '' : padChars) + text + (padRight ? padChars : '');
  } else if (padLength < 0) {
    text = text.substr(0, targetLength);
  }
  return text;
}

function _livereload() {
  var srcdirs = new ItemArray(argv.livereload);
  var srcfiles = new ItemArray();

  for (idx in srcdirs.items) {
    if (!_isValidPath(srcdirs.items[idx], 'd')) {
      log.ter('Directory \'' + srcdirs.items[idx] + '\' is invalid', 0, true);
    }
    srcfiles.add(pkg.path.join(srcdirs.items[idx], '**', '*'));
  }
  if (_scssSingleton.singleton !== undefined) {
    srcfiles.add([_scssSingleton.singleton.cssfiles]);
  }

  if (srcfiles.items.length === 0) {
    log.wrn('Nothing to watch for Livereload')
       .wrn('Did you miss the parameter to add livereload files?');
    return;
  }

  log.sep(' livereload-config > ')
     .inf('Watching for LiveReload:')
     .inf(srcfiles.items, '', 2)
     .sep(' < livereload-config ');
  pkg.livereload.listen();
  for (var idx in srcfiles.items) {            // bug in Gulp v4.0.2, does not watch windows file path
    srcfiles.items[idx] = srcfiles.items[idx].replace(/\\/g, '/');
  }

  //pkg.gulp.watch('./wp-content/themes/olympos/lib/*.js', ['minify']);
  const watcher = pkg.gulp.watch(srcfiles.items);
  watcher
    .on('add', _livereloadChanged)
    .on('change', _livereloadChanged)
    .on('unlink', _livereloadChanged);
  return;
}

function _livereloadChanged(path, stats) {
  pkg.livereload.changed(path);
  pkg.livereload();
}

function _minifyjs() {
  var minifyjss = pkg.path.join((argv.minifyjss === '' ? process.cwd() : argv.minifyjss),
      '*.js');
  var minifyjsd = (argv.minifyjsd === '' ? process.cwd(): argv.minifyjsd);
  var minifyjsf = (argv.minifyjsf === '' && argv.minifyjsf.endsWith('.js'))
      ? argv.minifyjsf : argv.minifyjsf + '.min.js';
  log.sep(' minifyjs-config >')
     .inf('Source Dir     : ' + minifyjss)
     .inf('Destination Dir: ' + minifyjsd)
     .inf('Ugly File      : ' + (minifyjsf === '' ? 'Not provided' : minifyjsf))
     .inf('Source Map     : ' + (argv.sourcemap ? 'Generate' : 'Remove'))
     .sep(' < minifyjs-config ');

  var sourceMapFilePattern = pkg.path.join(minifyjsd, '*.map');
  log.inf('Removing maps ' + sourceMapFilePattern);
  pkg.del.sync([sourceMapFilePattern], {force: true});

  if (argv.minifyjsf === '') {
    pkg.gulp.src(minifyjss)
        .pipe(pkg.if(argv.sourcemap, pkg.sourcemaps.init()))        // create sourcemaps only parameter set
        .pipe(pkg.minifyjs())
        .pipe(pkg.if(argv.sourcemap, pkg.sourcemaps.write('./')))   // write sourcemap only if dev build
        .pipe(pkg.gulp.dest(minifyjsd));

  } else {
    pkg.gulp.src(minifyjss)
        .pipe(pkg.if(argv.sourcemap, pkg.sourcemaps.init()))        // create sourcemaps only parameter set
        .pipe(pkg.concat(minifyjsf))
        .pipe(pkg.gulp.dest(minifyjsd))
        //      .pipe(pkg.if(arg['minifyjs-file'] !== '', pkgRename(argv.minifyjsf)))
        .pipe(pkg.minifyjs())
        .pipe(pkg.if(argv.sourcemap, pkg.sourcemaps.write('./')))   // write sourcemap only if dev build
        .pipe(pkg.gulp.dest(minifyjsd));
  }
}

/* -----------------------------------------------------------------------------
 * Creates and returns singleton object if it does not exist, else returns
 * existing object.
 * -----------------------------------------------------------------------------
 */
function _scssSingleton() {
  if (_scssSingleton.singleton === undefined) {
    _scssSingleton.singleton = new Scss(argv.dev, argv.style, argv.sourcemap
        , argv.scssdir, argv.cssdir, argv.scssfiles
        , argv.drupalroot, argv.theme
        , argv.verbose);
  }
  return _scssSingleton.singleton;
}

/* -----------------------------------------------------------------------------
 * Displays welcome message, called on start of script.
 * -----------------------------------------------------------------------------
 */
function _showWelcomeMessage() {
  log.inf(pkg.this.name + ' v' + pkg.this.version)
     .inf(pkg.this.description)
     .inf(pkg.this.author + ' (' + pkg.this.homepage + '), 2019')
     .inf('Use \'gulp usage\' for help, Ctrl+C to terminate');
}

/* -----------------------------------------------------------------------------
 * Displays message on usage of the script, with options that are available on
 * the command prompt.
 * -----------------------------------------------------------------------------
 */
function _usage() {
  log.sep(' usage > ')
     .inf('Usage: gulp [command] [options]', 'cyan')
     .inf('Commands:', 'cyan')
     .inf('  [default]         Execute scssclean and scss and watch SCSS files for changes')
     .inf('  imagemin          Minify images')
     .inf('  livereload        Watch CSS, JS and Template directories, and reload browser,')
     .inf('                    requires browser add-ons:')
     .inf('                    Chrome: https://chrome.google.com/webstore/detail/livereload/jnihajbhpnppcggbcgedagnkighmdlei')
     .inf('                    Firefox: https://addons.mozilla.org/en-US/firefox/addon/livereload-web-extension/')
     .inf('                    More info on extensions at http://livereload.com/extensions/')
     .inf('  scss              Execute SCSS/SASS preprocessor')
     .inf('  scssclean         Remove *.map files')
     .inf('  minifyjs          Minify JS files')
     .inf('  usage             Display usage information')
     .inf('Options:', 'cyan')
     .inf('  General:', 'cyan')
     .inf('  -B, --beep        Beep on completion of important task          [boolean]')
     .inf('  -D, --dev         Use Development options for building          [boolean]')
     .inf('  -V, --verbose     Log detailed messages                         [boolean]')
     .inf('  Drupal+Bootstrap:', 'cyan')
     .inf('  -d, --drupalroot  Specify Drupal root directory, use with -t    [optional]')
     .inf('  -t, --theme       Drupal theme directory name, use with -d')
     .inf('  SCSS:', 'cyan')
     .inf('  -s, --scssdir     SCSS directory to watch and process, use with -c')
     .inf('  -c, --cssdir      CSS directory for SCSS output, use with -s')
     .inf('  -e, --scssfiles   SCSS files to preprocess, comma-delimited')
     .inf('  -y, --style       SCSS output style, compact|compressed|expanded|nested')
     .inf('  -m, --sourcemap   Creates sourcemap (*.map) files               [boolean]')
     .inf('  Live Reload:', 'cyan')
     .inf('  -l, --livereload  Watch files for livereload')
     .inf('  Imagemin:', 'cyan')
     .inf('  -i, --imagemin    Image directories to minify')
     .inf('  Minify JS:', 'cyan')
     .inf('  -m, --minifyjss   Minify JS source directory')
     .inf('  -v, --minifyjsd   Minify JS destination directory')
     .inf('  -w, --minifyjsf   Minify JS destination file if to be merged')
     .inf('Examples:', 'cyan')
     .inf('  gulp')
     .inf('  gulp scss')
     .inf('  gulp -BDdm -r d:\\htdocs\\d8 -t=mytheme')
     .inf('  gulp --beep --drupalroot d:\\htdocs\\d8')
     .sep(' < usage ');
}

/* -----------------------------------------------------------------------------
 * Tried to write a common function so as not to write the same code for
 * various file system objects that need to be checked before processing starts.
 * -----------------------------------------------------------------------------
 */
function _validatePaths(pathArray) {
  for (var idx in pathArray) {
    path = pathArray[idx];
    if (!_isValidPath(path[0], path[1])) {
      log.err(`${path[0]} is not a valid ${path[1] === 'D' ? 'directory' : 'file'}
        `, 0, true);
      process.exit(-1);
    }
  }
}

const log = new Log('', argv.beep, argv.verbose);

function imagemin(cb) {
  _imagemin();
  cb();
}

function livereload(cb) {
  _livereload();
  cb();
}

function minifyjs(cb) {
  _minifyjs();
  cb();
}

function scssclean(cb) {
  _scssSingleton().clean();
  cb();
}

function scsspreprocess(cb) {
  _scssSingleton().preprocess();
  cb();
}

function scsswatch(cb) {
  _scssSingleton().watch();
  cb();
}

function usage(cb) {
  _usage();
  cb();
}

_showWelcomeMessage();
exports.default = pkg.gulp.series(scssclean, scsspreprocess, scsswatch, livereload);
exports.imagemin = imagemin;
exports.livereload = livereload;
exports.scssclean = scssclean;
exports.scss = pkg.gulp.series(scssclean, scsspreprocess);
exports.minifyjs = minifyjs;
exports.usage = usage;

/* -----------------------------------------------------------------------------
 * Beautifies text with foreground and background color, and other options
 * Usage: console.log(beautifyText(text, ['fggrey', 'bgred', 'inverse']));
 * -----------------------------------------------------------------------------
 */
function beautifyText(text, options) {
  if (beautifyText.textAttributes === undefined) {
    beautifyText.textAttributes = {
      'reset'        : '\x1b[0m' ,
      'bold'         : '\x1b[1m' ,    'end_bold'         : '\x1b[21m',
      'dim'          : '\x1b[2m' ,    'end_dim'          : '\x1b[22m',
      'italic'       : '\x1b[3m' ,    'end_italic'       : '\x1b[23m',
      'underline'    : '\x1b[4m' ,    'end_underline'    : '\x1b[24m',
      'blink'        : '\x1b[5m' ,    'end_blink'        : '\x1b[25m',
      'unknown'      : '\x1b[6m' ,    'end_unknown'      : '\x1b[26m',
      'inverse'      : '\x1b[7m' ,    'end_inverse'      : '\x1b[27m',
      'hidden'       : '\x1b[8m' ,    'end_hidden'       : '\x1b[28m',
      'strikethrough': '\x1b[9m' ,    'end_strikethrough': '\x1b[29m',
      'fgblack'      : '\x1b[30m',    'end_fgblack'      : '\x1b[39m',
      'fgred'        : '\x1b[31m',    'end_fgred'        : '\x1b[39m',
      'fggreen'      : '\x1b[32m',    'end_fggreen'      : '\x1b[39m',
      'fgyellow'     : '\x1b[33m',    'end_fgyellow'     : '\x1b[39m',
      'fgblue'       : '\x1b[34m',    'end_fgblue'       : '\x1b[39m',
      'fgmagenta'    : '\x1b[35m',    'end_fgmagenta'    : '\x1b[39m',
      'fgcyan'       : '\x1b[36m',    'end_fgcyan'       : '\x1b[39m',
      'fgwhite'      : '\x1b[37m',    'end_fgwhite'      : '\x1b[39m',
      'fggrey'       : '\x1b[90m',    'end_fggrey'       : '\x1b[39m',
      'bgblack'      : '\x1b[40m',    'end_bgblack'      : '\x1b[49m',
      'bgred'        : '\x1b[41m',    'end_bgred'        : '\x1b[49m',
      'bggreen'      : '\x1b[42m',    'end_bggreen'      : '\x1b[49m',
      'bgyellow'     : '\x1b[43m',    'end_bgyellow'     : '\x1b[49m',
      'bgblue'       : '\x1b[44m',    'end_bgblue'       : '\x1b[49m',
      'bgmagenta'    : '\x1b[45m',    'end_bgmagenta'    : '\x1b[49m',
      'bgcyan'       : '\x1b[46m',    'end_bgcyan'       : '\x1b[49m',
      'bgwhite'      : '\x1b[47m',    'end_bgwhite'      : '\x1b[49m',
    }
  }
  if (!Array.isArray(options)) {
    options = [options];
  }
  attributes = endAttributes = '';
  for (idx in options) {
    option = options[idx].toLowerCase();
    if (beautifyText.textAttributes[option] !== undefined) {
      attributes = attributes + beautifyText.textAttributes[option];
      endAttributes = beautifyText.textAttributes['end_' + option] + endAttributes;
    }
  }
  return attributes + text + endAttributes; //beautifyText.textAttributes['reset'];
}
