<?php
/**
 * Plugin Name: New Media – تحسينات الموقع
 * Description: تطبّق مرة واحدة عند التفعيل: تصحيح الأخطاء الإملائية، إيقاف النافذة المنبثقة التجريبية، نقل العناصر التجريبية لسلة المهملات، نشر سياسة الخصوصية، وتحسين المدونة ومعرض الأعمال. بعد التفعيل يمكنك حذف الإضافة والتعديلات تبقى.
 * Version: 1.0.0
 * Requires at least: 5.0
 * Requires PHP: 7.4
 * Text Domain: newmedia-site-fixes
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

require_once __DIR__ . '/content.php';

const NMSF_OPTION = 'nmsf_report';

/** تصحيحات النصوص (نص قديم => نص جديد). تُطبّق على عبارات كاملة فقط. */
function nmsf_replacements() {
	return array(
		'نحن نوفر الحل الأمثل لعملك نحن نوفر الحل الأمثل لعملك نحن نوفر الحل الأمثل لعملك' => 'صمّم هوية بصرية احترافية تعكس شخصية علامتك التجارية وتترك انطباعاً قوياً لدى جمهورك.',
		'أعمالنافي'                     => 'أعمالنا في',
		'إدارة حسابات السوشيل لصالح'     => 'إدارة حسابات السوشيال ميديا لصالح',
		'السوشيل ميديا'                 => 'السوشيال ميديا',
		'التسويق الكتروني'              => 'التسويق الإلكتروني',
		'محليًا وعالمياً'               => 'محليًا وعالميًا',
		'إحترافي'                       => 'احترافي',
		'نعزز وجودك الرقمي وزيادة الوعي' => 'نعزز وجودك الرقمي ونزيد الوعي',
		'انضم الينا'                    => 'انضم إلينا',
		'أراء عملائنا'                  => 'آراء عملائنا',
		'معنا الأن'                     => 'معنا الآن',
		'للبدأ'                         => 'للبدء',
		'أخر تحديثاتنا'                 => 'آخر تحديثاتنا',
		'الرئيسة'                       => 'الرئيسية',
		'الموشن الجرافيكي'              => 'الموشن جرافيك',
		'موشن جرافيكي'                  => 'موشن جرافيك',
		'مواقع الويب UXUI'              => 'مواقع الويب UX/UI',
		'نابلس -شارع'                   => 'نابلس - شارع',
		'طولكرم -كراجات'                => 'طولكرم - كراجات',
		'الباقة الغربية -شارع'           => 'الباقة الغربية - شارع',
		'البريد الإلكنروني'             => 'البريد الإلكتروني',
		'أكتب لنا'                      => 'اكتب لنا',
		'رقم الواتس اب'                 => 'رقم الواتساب',
		'أطلب خدمة'                     => 'اطلب خدمة',
		'خدمة الأن'                     => 'خدمة الآن',
	);
}

/** يطبّق التصحيحات على نص عادي أو JSON (يدعم الأحرف العربية المحفوظة بصيغة \uXXXX). */
function nmsf_fix_text( $text, &$count ) {
	if ( ! is_string( $text ) || '' === $text ) {
		return $text;
	}
	foreach ( nmsf_replacements() as $from => $to ) {
		$n    = 0;
		$text = str_replace( $from, $to, $text, $n );
		$count += $n;
		// نفس العبارة بصيغة JSON المرمّزة (كما يحفظها Elementor).
		$from_j = substr( json_encode( $from ), 1, -1 );
		$to_j   = substr( json_encode( $to ), 1, -1 );
		if ( $from_j !== $from ) {
			$n    = 0;
			$text = str_replace( $from_j, $to_j, $text, $n );
			$count += $n;
		}
	}
	return $text;
}

/** يزيل المسافات العادية وغير المرئية (مثل &nbsp;) من بداية ونهاية النص ويوحّد المسافات المكررة. */
function nmsf_clean( $s ) {
	$s = preg_replace( '/[ \x{00A0}]{2,}/u', ' ', (string) $s );
	return preg_replace( '/^[\s\x{00A0}\x{200E}\x{200F}]+|[\s\x{00A0}\x{200E}\x{200F}]+$/u', '', $s );
}

function nmsf_log( &$report, $msg ) {
	$report[] = $msg;
}

function nmsf_run() {
	global $wpdb;
	$report  = array();
	$touched = array();

	// 1) تصحيح النصوص في الصفحات والمقالات والأعمال والقوالب والنماذج.
	$types = array( 'page', 'post', 'portfolio', 'cms_block', 'uicore-tb', 'elementor_library', 'wpforms', 'nav_menu_item', 'wpcf7_contact_form' );
	$in    = implode( ',', array_fill( 0, count( $types ), '%s' ) );
	$rows  = $wpdb->get_results( $wpdb->prepare( "SELECT ID, post_type, post_title, post_content, post_excerpt FROM {$wpdb->posts} WHERE post_status IN ('publish','draft','private','future') AND post_type IN ($in)", $types ) );
	$total = 0;
	foreach ( $rows as $r ) {
		$c       = 0;
		$title   = 'nav_menu_item' === $r->post_type ? nmsf_fix_text( $r->post_title, $c ) : nmsf_clean( nmsf_fix_text( $r->post_title, $c ) );
		$content = nmsf_fix_text( $r->post_content, $c );
		$excerpt = nmsf_fix_text( $r->post_excerpt, $c );
		if ( $title !== $r->post_title ) {
			$c++;
		}
		if ( $c ) {
			$wpdb->update( $wpdb->posts, array( 'post_title' => $title, 'post_content' => $content, 'post_excerpt' => $excerpt ), array( 'ID' => $r->ID ) );
			$touched[ $r->ID ] = true;
			$total += $c;
		}
		$meta = $wpdb->get_results( $wpdb->prepare( "SELECT meta_id, meta_value FROM {$wpdb->postmeta} WHERE post_id = %d AND meta_key = '_elementor_data'", $r->ID ) );
		foreach ( $meta as $m ) {
			$mc  = 0;
			$new = nmsf_fix_text( $m->meta_value, $mc );
			if ( $mc && null !== json_decode( $new ) ) {
				$wpdb->update( $wpdb->postmeta, array( 'meta_value' => $new ), array( 'meta_id' => $m->meta_id ) );
				$touched[ $r->ID ] = true;
				$total += $mc;
			}
		}
	}
	nmsf_log( $report, sprintf( 'تصحيح %d خطأ إملائي/نصي في %d عنصر.', $total, count( $touched ) ) );

	// 2) ملخصات معرض الأعمال (كانت كلها "لشركة متخصصة في مجال التقنية").
	$excerpts = array(
		10512 => 'تصميم هوية بصرية كاملة تشمل الشعار والألوان والخطوط والمطبوعات لشركة متخصصة في مجال الأثاث.',
		10539 => 'تصميم هوية بصرية كاملة تشمل الشعار والألوان والخطوط والمطبوعات لأحد المطاعم.',
		10542 => 'تصميم هوية بصرية كاملة تشمل الشعار والألوان والخطوط والمطبوعات لعيادة أسنان.',
		10545 => 'تصميم هوية بصرية كاملة تشمل الشعار والألوان والخطوط والمطبوعات لأحد المراكز التعليمية.',
		10548 => 'تصميم هوية بصرية كاملة تشمل الشعار والألوان والخطوط والمطبوعات لمطعم مأكولات بحرية.',
		10551 => 'إدارة حسابات التواصل الاجتماعي وتصميم المحتوى لصالح أحد النوادي.',
		10554 => 'إدارة حسابات التواصل الاجتماعي وتصميم المحتوى لشركة عقارات.',
		10557 => 'إدارة حسابات التواصل الاجتماعي وتصميم المحتوى لشركة أجهزة كهربائية.',
	);
	$n = 0;
	foreach ( $excerpts as $id => $ex ) {
		$p = get_post( $id );
		if ( ! $p || 'portfolio' !== $p->post_type ) {
			continue;
		}
		$done = false;
		if ( false !== strpos( $p->post_excerpt, 'مجال التقنية' ) ) {
			$wpdb->update( $wpdb->posts, array( 'post_excerpt' => $ex ), array( 'ID' => $id ) );
			$done = true;
		}
		// الوصف المختصر الذي يظهر تحت كل مشروع في الصفحة الرئيسية.
		if ( false !== strpos( (string) get_post_meta( $id, 'short_description', true ), 'مجال التقنية' ) ) {
			update_post_meta( $id, 'short_description', $ex );
			$done = true;
		}
		if ( $done ) {
			$touched[ $id ] = true;
			$n++;
		}
	}
	nmsf_log( $report, sprintf( 'تحديث وصف %d مشروع في معرض الأعمال.', $n ) );

	// 3) إيقاف النافذة المنبثقة التجريبية بالإنجليزي (HEY YOU, SIGN UP AND CONNECT TO WOODMART!).
	$wd = get_option( 'xts-woodmart-options' );
	if ( is_array( $wd ) && ! empty( $wd['promo_popup'] ) ) {
		$wd['promo_popup'] = '0';
		update_option( 'xts-woodmart-options', $wd );
		nmsf_log( $report, 'إيقاف النافذة المنبثقة التجريبية (Woodmart promo popup).' );
	}

	// 4) نقل العناصر التجريبية إلى سلة المهملات (يمكن استرجاعها خلال 30 يوماً).
	$demo = array(
		2    => array( 'page', 'مثال على صفحة' ),
		11   => array( 'page', 'الرئيسية2' ),
		958  => array( 'woodmart_slide', 'Fashion slide 1' ),
		998  => array( 'woodmart_slide', 'Fashion slide 2' ),
		1004 => array( 'woodmart_slide', 'Fashion slide 3' ),
		808  => array( 'cms_block', 'Open pop-up' ),
	);
	$front = (int) get_option( 'page_on_front' );
	$n     = 0;
	foreach ( $demo as $id => $d ) {
		$p = get_post( $id );
		if ( $p && $id !== $front && 'trash' !== $p->post_status && $p->post_type === $d[0] && nmsf_clean( $p->post_title ) === $d[1] ) {
			wp_trash_post( $id );
			$n++;
		}
	}
	nmsf_log( $report, sprintf( 'نقل %d عنصر تجريبي إلى سلة المهملات.', $n ) );

	// 5) سياسة الخصوصية: كتابة المحتوى ونشر الصفحة.
	$pp = get_post( 3 );
	if ( ! $pp || 'page' !== $pp->post_type || 'trash' === $pp->post_status ) {
		$pp_id = wp_insert_post( array( 'post_type' => 'page', 'post_title' => 'سياسة الخصوصية', 'post_status' => 'publish', 'post_content' => nmsf_privacy_policy_html() ) );
	} else {
		$pp_id = wp_update_post( array( 'ID' => 3, 'post_title' => 'سياسة الخصوصية', 'post_status' => 'publish', 'post_content' => nmsf_privacy_policy_html() ) );
	}
	if ( $pp_id && ! is_wp_error( $pp_id ) ) {
		update_option( 'wp_page_for_privacy_policy', (int) $pp_id );
		nmsf_log( $report, 'نشر صفحة سياسة الخصوصية: ' . get_permalink( $pp_id ) );
	}

	// 6) المدونة: كانت 3 مقالات بنفس العنوان، واثنتان منها غير مكتملتين.
	$dup = 'إدارة صفحات التواصل الاجتماعي';
	$p   = get_post( 10835 );
	if ( $p && 'post' === $p->post_type && nmsf_clean( $p->post_title ) === $dup ) {
		wp_update_post( array( 'ID' => 10835, 'post_title' => 'أنواع التسويق بالمحتوى', 'post_name' => 'أنواع-التسويق-بالمحتوى' ) );
		nmsf_log( $report, 'المقال الأول أصبح عنوانه: أنواع التسويق بالمحتوى (يطابق محتواه).' );
	}
	$p = get_post( 10849 );
	if ( $p && 'post' === $p->post_type && nmsf_clean( $p->post_title ) === $dup && mb_strlen( wp_strip_all_tags( $p->post_content ) ) < 300 ) {
		wp_update_post( array( 'ID' => 10849, 'post_title' => 'أهمية الموقع الإلكتروني لنجاح عملك', 'post_name' => 'أهمية-الموقع-الإلكتروني-لنجاح-عملك', 'post_content' => nmsf_post_website_html() ) );
		nmsf_log( $report, 'إكمال المقال الثاني: أهمية الموقع الإلكتروني لنجاح عملك.' );
	}
	$p = get_post( 10851 );
	if ( $p && 'post' === $p->post_type && nmsf_clean( $p->post_title ) === $dup && mb_strlen( wp_strip_all_tags( $p->post_content ) ) < 300 ) {
		wp_update_post( array( 'ID' => 10851, 'post_title' => $dup, 'post_name' => 'إدارة-صفحات-التواصل-الاجتماعي', 'post_content' => nmsf_post_social_html() ) );
		nmsf_log( $report, 'إكمال المقال الثالث: إدارة صفحات التواصل الاجتماعي.' );
	}

	// 6.5) نصوص الهيدر (Woodmart Header Builder) مثل زر "أطلب خدمة الأن".
	$hc   = 0;
	$hdrs = $wpdb->get_col( "SELECT option_name FROM {$wpdb->options} WHERE option_name LIKE 'whb\_%'" );
	foreach ( $hdrs as $name ) {
		$val = get_option( $name );
		if ( ! is_array( $val ) ) {
			continue;
		}
		$c = 0;
		array_walk_recursive(
			$val,
			function ( &$v ) use ( &$c ) {
				if ( is_string( $v ) ) {
					$v = nmsf_fix_text( $v, $c );
				}
			}
		);
		if ( $c ) {
			update_option( $name, $val );
			$hc += $c;
		}
	}
	if ( $hc ) {
		nmsf_log( $report, sprintf( 'تصحيح %d نص في الهيدر (زر: اطلب خدمة الآن).', $hc ) );
	}

	// 6.6) هيدر أسود: يُضاف إلى "CSS إضافي" في المخصّص، فيبقى حتى بعد حذف الإضافة.
	$marker = '/* New Media: black header */';
	$css    = (string) wp_get_custom_css();
	if ( false === strpos( $css, $marker ) ) {
		$header_css = $marker . '
.whb-header .whb-row,
.whb-header .whb-general-header,
.whb-header .whb-top-bar,
.whb-header .whb-header-bottom,
.whb-header.whb-sticked .whb-row,
.whb-sticky-prepared .whb-row { background-color: #000 !important; border-color: #000 !important; }
.whb-header .wd-nav-main > li > a,
.whb-header .wd-header-nav .wd-nav > li > a,
.whb-header .wd-tools-element > a,
.whb-header .wd-tools-element .wd-tools-icon,
.whb-header .wd-header-text,
.whb-header .wd-logo .site-title { color: #fff !important; }
.whb-header .wd-nav-main > li.current-menu-item > a,
.whb-header .wd-nav-main > li > a:hover { opacity: .8; }
/* End New Media: black header */';
		wp_update_custom_css_post( trim( $css . "\n\n" . $header_css ) );
		nmsf_log( $report, 'تغيير لون الهيدر إلى الأسود (من: المظهر ← تخصيص ← CSS إضافي).' );
	}

	// 7) وصف الموقع (يظهر في عنوان المتصفح ونتائج البحث).
	if ( '' === trim( (string) get_option( 'blogdescription' ) ) ) {
		update_option( 'blogdescription', 'وكالة إعلام وتسويق رقمي' );
		nmsf_log( $report, 'إضافة وصف الموقع: وكالة إعلام وتسويق رقمي.' );
	}

	// 8) مسح الكاش ليظهر التغيير فوراً.
	foreach ( array_keys( $touched ) as $id ) {
		delete_post_meta( $id, '_elementor_element_cache' );
		clean_post_cache( $id );
	}
	if ( function_exists( 'wpo_cache_flush' ) ) {
		wpo_cache_flush();
	}
	if ( has_action( 'litespeed_purge_all' ) ) {
		do_action( 'litespeed_purge_all' );
	}
	wp_cache_flush();
	nmsf_log( $report, 'مسح الكاش.' );

	update_option( NMSF_OPTION, array( 'time' => current_time( 'mysql' ), 'items' => $report ), false );
}

register_activation_hook( __FILE__, 'nmsf_run' );

add_action(
	'admin_notices',
	function () {
		$r = get_option( NMSF_OPTION );
		if ( ! $r || ! current_user_can( 'manage_options' ) ) {
			return;
		}
		echo '<div class="notice notice-success"><p><strong>تم تطبيق تحسينات New Media بنجاح:</strong></p><ul style="list-style:disc;padding-inline-start:20px">';
		foreach ( $r['items'] as $i ) {
			echo '<li>' . esc_html( $i ) . '</li>';
		}
		echo '</ul><p>يمكنك الآن تعطيل هذه الإضافة وحذفها، والتعديلات ستبقى.</p></div>';
	}
);

register_uninstall_hook( __FILE__, 'nmsf_uninstall' );
function nmsf_uninstall() {
	delete_option( NMSF_OPTION );
}
